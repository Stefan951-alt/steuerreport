/* Optionen je Depot und Kontrakt, nach dem BMF-Schreiben „Einzelfragen zur Abgeltungsteuer“ vom 14.5.2025 (Rn. 21 bis 34).
   Gekaufte Option: Prämie und Gebühren sind Anschaffungskosten. Verkauf, Barausgleich und Verfall ergeben Gewinn oder Verlust.
   Verkaufte Option (Stillhalter): Die Prämie zählt beim Zufluss, ein Rückkauf als negative Einnahme bei Zahlung (§ 20 Abs. 1 Nr. 11 EStG).
   Wird der Basiswert geliefert, entsteht bei der Option kein eigenes Ergebnis: Die Prämie des Käufers geht in das Aktiengeschäft ein,
   die des Stillhalters bleibt Stillhalterprämie. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};
  const M = K.money;
  const F = K.fifo;

  // Kürzel laut IBKR: Ep = verfallen, A = Zuteilung (Stillhalter), Ex/AEx/MEx = Ausübung (Käufer).
  const isExpiry = t => F.hasCode(t.notes, 'Ep');
  const isAssignment = t => F.hasCode(t.notes, 'A');
  const isExercise = t => ['Ex', 'AEx', 'MEx'].some(code => F.hasCode(t.notes, code));

  // Verteilt einen Betrag auf Teilmengen. Das letzte Teilstück bekommt den Rest, damit die Summe der Teile dem Ganzen entspricht.
  function splitter(total, qty) {
    let restQty = qty;
    let rest = total;
    return function (take) {
      const part = take === restQty ? rest : Math.round(total * take / qty);
      restQty -= take;
      rest -= part;
      return part;
    };
  }

  // Nimmt die zuerst eröffneten Stücke zuerst (FIFO). Gibt die Menge zurück, für die kein Bestand da war.
  function takeLots(lots, want, each) {
    let rest = want;
    while (rest > 0 && lots.length) {
      const lot = lots[0];
      const q = Math.min(rest, lot.q);
      const cents = q === lot.q ? lot.cents : Math.round(lot.cents * q / lot.q);
      lot.q -= q;
      lot.cents -= cents;
      if (lot.q === 0) lots.shift();
      rest -= q;
      each(q, cents, lot.date);
    }
    return rest;
  }

  // events: alle Geschäfte EINES Optionskontrakts in EINEM Depot, zeitlich sortiert.
  // Ergebnis: steuerliche Vorgänge mit Datum und Betrag in Euro-Cent (cents = null: nicht berechenbar).
  function run(events) {
    const longLots = [];    // gekaufte Optionen, cents = Anschaffungskosten
    const shortLots = [];   // verkaufte Optionen, cents = vereinnahmte Prämie
    const items = [];
    const timeline = [];
    const flags = {};

    events.forEach(function (t) {
      const signed = M.toQty(t.quantity);
      if (signed === 0) return;
      if (/\(Ca\.\)/.test(t.buySell) || F.hasCode(t.notes, 'Ca') || F.hasCode(t.notes, 'Co') || /Cancel|Correct/i.test(t.transactionType)) flags.cancellation = true;
      timeline.push({ date: t.date, delta: signed });
      const qty = Math.abs(signed);
      const share = splitter(F.cashCents(t, flags), qty);
      const closingOnly = F.hasCode(t.openClose, 'C') && !F.hasCode(t.openClose, 'O');
      const add = (kind, q, cents, extra) => items.push(Object.assign({ kind: kind, date: t.date, trade: t, q: q, cents: cents }, extra));

      if (signed < 0) {
        // Verkauf: schließt zuerst gekaufte Optionen, der Rest eröffnet eine Stillhalterposition.
        const rest = takeLots(longLots, qty, function (q, cost, lotDate) {
          const proceeds = share(q);
          const detail = { proceedsCents: proceeds, costCents: cost, lotDate: lotDate };
          if (isExpiry(t)) add('verfall', q, proceeds - cost, detail);
          else if (isExercise(t) && proceeds === 0) add('ausuebung', q, 0, detail);
          else add(isExercise(t) ? 'barausgleich' : 'verkauf', q, proceeds - cost, detail);
        });
        if (rest > 0) {
          const cash = share(rest);
          if (closingOnly || isExpiry(t) || isExercise(t)) {
            flags.missingHistory = true;
            add('ohneKauf', rest, null, { proceedsCents: cash });
          } else {
            if (!F.hasCode(t.openClose, 'O')) flags.noIndicator = true;
            shortLots.push({ date: t.date, q: rest, cents: cash });
            add('praemie', rest, cash, {});
          }
        }
      } else {
        // Kauf: schließt zuerst Stillhalterpositionen, der Rest ist eine gekaufte Option.
        const close = function (q, paid, extra) {
          if (isExpiry(t) && paid === 0) add('verfallStillhalter', q, 0, extra);
          else if (isAssignment(t) && paid === 0) add('zuteilung', q, 0, extra);
          else add(isAssignment(t) ? 'barausgleichStillhalter' : 'glattstellung', q, paid, extra);
        };
        const rest = takeLots(shortLots, qty, function (q, premium, lotDate) {
          close(q, share(q), { premiumCents: premium, lotDate: lotDate });
        });
        if (rest > 0) {
          const cash = share(rest);
          if (closingOnly || isExpiry(t) || isAssignment(t)) {
            // Die Eröffnung steht nicht in den Daten. Ein Rückkauf zählt trotzdem: maßgeblich ist der Zeitpunkt der Zahlung.
            flags.missingHistory = true;
            close(rest, cash, { ohneEroeffnung: true });
          } else {
            if (!F.hasCode(t.openClose, 'O')) flags.noIndicator = true;
            longLots.push({ date: t.date, q: rest, cents: -cash });
          }
        }
      }
    });

    return { items: items, longLots: longLots, shortLots: shortLots, timeline: timeline, flags: flags };
  }

  K.optionen = { run: run };
})(typeof window !== 'undefined' ? window : globalThis);
