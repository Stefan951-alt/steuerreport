/* FIFO je Wertpapier und Depot: die zuerst gekauften Stücke gelten als zuerst verkauft (§ 20 Abs. 4 Satz 7 EStG).
   Anschaffungskosten werden zum Kurs des Kauftags in Euro umgerechnet, der Erlös zum Kurs des Verkaufstags. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};
  const M = K.money;

  function hasCode(codes, code) {
    return String(codes || '').split(';').some(c => c.trim() === code);
  }

  // Zahlungsfluss eines Geschäfts in Euro-Cent: negativ beim Kauf, positiv beim Verkauf, Gebühren und Steuern eingerechnet.
  function cashCents(trade, flags) {
    const feeCurrency = trade.commissionCurrency || trade.currency;
    if (feeCurrency === trade.currency) return M.toCents((trade.proceeds + trade.taxes + trade.commission) * trade.fx);
    if (feeCurrency === 'EUR') return M.toCents((trade.proceeds + trade.taxes) * trade.fx) + M.toCents(trade.commission);
    flags.commissionCurrency = true;
    return M.toCents((trade.proceeds + trade.taxes + trade.commission) * trade.fx);
  }

  function compareEvents(a, b) {
    if (a.sort !== b.sort) return a.sort < b.sort ? -1 : 1;
    return (a.fileSeq - b.fileSeq) || (a.seq - b.seq);
  }

  // events: Käufe, Verkäufe und Kapitalmaßnahmen EINES Wertpapiers in EINEM Depot, zeitlich sortiert.
  function run(events) {
    const lots = [];
    const realizations = [];
    const timeline = [];          // Mengenänderungen, die diese Rechnung nachvollzogen hat – Grundlage für den Bestandsabgleich
    const unprocessedActions = [];
    const flags = {};
    let shortQty = 0;

    const heldQty = () => lots.reduce((s, l) => s + l.q, 0);

    function buy(trade, qty, costCents) {
      let rest = qty;
      let restCost = costCents;
      if (shortQty > 0) {
        const cover = Math.min(rest, shortQty);
        const coverCost = cover === rest ? restCost : Math.round(restCost * cover / rest);
        shortQty -= cover;
        rest -= cover;
        restCost -= coverCost;
        flags.short = true;
      } else if (hasCode(trade.openClose, 'C') && !hasCode(trade.openClose, 'O')) {
        // Eindeckung einer Short-Position, deren Eröffnung nicht in den Daten steht: daraus entsteht kein Bestand.
        flags.short = true;
        flags.missingHistory = true;
        return;
      }
      if (rest > 0) lots.push({ date: trade.date, tradeId: trade.id, q: rest, costCents: restCost });
    }

    function sell(trade, qty, proceedsCents) {
      const pieces = [];
      let rest = qty;
      let restProceeds = proceedsCents;
      while (rest > 0 && lots.length) {
        const lot = lots[0];
        const take = Math.min(rest, lot.q);
        // Das jeweils letzte Teilstück bekommt den Rest, damit die Summe der Teile exakt dem Ganzen entspricht.
        const proceeds = take === rest ? restProceeds : Math.round(proceedsCents * take / qty);
        const cost = take === lot.q ? lot.costCents : Math.round(lot.costCents * take / lot.q);
        pieces.push({ q: take, lotDate: lot.date, lotTradeId: lot.tradeId, proceedsCents: proceeds, costCents: cost, gainCents: proceeds - cost });
        lot.q -= take;
        lot.costCents -= cost;
        if (lot.q === 0) lots.shift();
        rest -= take;
        restProceeds -= proceeds;
      }
      let unmatchedQty = 0;
      let shortOpenedQty = 0;
      if (rest > 0) {
        if (hasCode(trade.openClose, 'O')) {
          shortOpenedQty = rest;
          shortQty += rest;
          flags.short = true;
        } else {
          unmatchedQty = rest;
          flags.missingHistory = true;
        }
      }
      realizations.push({
        trade: trade, q: qty, pieces: pieces, unmatchedQty: unmatchedQty, shortOpenedQty: shortOpenedQty,
        proceedsCents: proceedsCents,
        costCents: pieces.reduce((s, p) => s + p.costCents, 0),
        gainCents: pieces.reduce((s, p) => s + p.gainCents, 0),
        complete: rest === 0
      });
    }

    // Ein Aktiensplit ist kein Verkauf: die Anschaffungskosten verteilen sich auf mehr (oder weniger) Stücke, Kaufdaten bleiben.
    function corporateAction(action) {
      const delta = M.toQty(action.quantity);
      const before = heldQty();
      const target = before + delta;
      const isSplit = action.type === 'FS' || action.type === 'RS';
      if (!isSplit || before <= 0 || target <= 0 || shortQty > 0) {
        unprocessedActions.push(action);
        return;
      }
      let assigned = 0;
      lots.forEach(function (lot, i) {
        const q = i === lots.length - 1 ? target - assigned : Math.round(lot.q * target / before);
        assigned += q;
        lot.q = q;
      });
      if (lots.some(l => l.q <= 0)) flags.splitRounding = true;
      timeline.push({ date: action.date, delta: delta });
      flags.splitsApplied = (flags.splitsApplied || 0) + 1;
    }

    events.forEach(function (ev) {
      if (ev.kind === 'corporateAction') {
        corporateAction(ev);
        return;
      }
      const q = M.toQty(ev.quantity);
      if (q === 0) return;
      // Kürzel laut IBKR: Ca = storniert, Co = korrigiert; A = Zuteilung, Ex/AEx/MEx = Ausübung einer Option.
      if (/\(Ca\.\)/.test(ev.buySell) || hasCode(ev.notes, 'Ca') || hasCode(ev.notes, 'Co') || /Cancel|Correct/i.test(ev.transactionType)) flags.cancellation = true;
      if (['A', 'Ex', 'AEx', 'MEx'].some(code => hasCode(ev.notes, code))) flags.optionDelivery = true;
      timeline.push({ date: ev.date, delta: q });
      const cash = cashCents(ev, flags);
      if (q > 0) buy(ev, q, -cash);
      else sell(ev, -q, cash);
    });

    return { lots: lots, realizations: realizations, timeline: timeline, unprocessedActions: unprocessedActions, flags: flags, shortQty: shortQty };
  }

  function positionAt(timeline, isoDate) {
    return timeline.reduce((s, e) => (e.date <= isoDate ? s + e.delta : s), 0);
  }

  K.fifo = { run: run, positionAt: positionAt, compareEvents: compareEvents };
})(typeof window !== 'undefined' ? window : globalThis);
