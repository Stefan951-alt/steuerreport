/* Aus den eingelesenen Buchungen werden die Formularwerte eines Steuerjahres – jede Summe mit ihren Einzelposten.
   Grundsatz: Was nicht sicher berechnet werden kann, steht als offener Punkt im Bericht und in keiner Summe. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};
  const M = K.money;
  const F = K.fifo;

  const COMPUTED_ASSETS = { STK: true, FUND: true };
  const ASSET_LABELS = {
    OPT: 'Optionen', FOP: 'Optionen auf Futures', FUT: 'Futures', CFD: 'CFDs', WAR: 'Optionsscheine',
    IOPT: 'Zertifikate und Hebelprodukte', BOND: 'Anleihen', BILL: 'Geldmarktpapiere', CRYPTO: 'Kryptowerte',
    CMDTY: 'Rohstoffe', FXCFD: 'Währungs-CFDs', FSFOP: 'Optionen auf Futures', FSOPT: 'Optionen mit Future-Abrechnung'
  };
  const FUND_TYPES = ['aktienfonds', 'mischfonds', 'immobilienfonds', 'auslandsimmobilienfonds', 'sonstigerfonds'];
  const TYPES = {
    aktie: { label: 'Aktie', group: 'aktie' },
    aktienfonds: { label: 'Aktienfonds', group: 'fonds', teilfreistellung: 30 },
    mischfonds: { label: 'Mischfonds', group: 'fonds', teilfreistellung: 15 },
    immobilienfonds: { label: 'Immobilienfonds', group: 'fonds', teilfreistellung: 60 },
    auslandsimmobilienfonds: { label: 'Auslands-Immobilienfonds', group: 'fonds', teilfreistellung: 80 },
    sonstigerfonds: { label: 'Sonstiger Investmentfonds', group: 'fonds', teilfreistellung: 0 },
    fonds_offen: { label: 'Fonds, Art noch offen', group: 'fonds_offen' },
    unbekannt: { label: 'Unklar', group: 'unbekannt' },
    ignorieren: { label: 'Nicht berechnen', group: 'ignorieren' }
  };
  const SELECTABLE_TYPES = ['aktie'].concat(FUND_TYPES, ['ignorieren']);
  const STOCK_SUBCATEGORIES = { COMMON: 1, ADR: 1, GDR: 1, PREFERRED: 1, 'NY REG SHRS': 1, 'DUTCH CERT': 1, REIT: 1 };
  const FUND_SUBCATEGORIES = { ETF: 1, 'CLOSED-END FUND': 1 };
  const CASH_KINDS = {
    'Dividends': 'dividend',
    'Payment In Lieu Of Dividends': 'pil',
    'Withholding Tax': 'wht',
    'Broker Interest Received': 'interest',
    'Broker Interest Paid': 'interestPaid',
    'Bond Interest Received': 'bond',
    'Bond Interest Paid': 'bond',
    'Other Fees': 'fee',
    'Broker Fees': 'fee',
    'Advisor Fees': 'fee',
    'Commission Adjustments': 'fee',
    'Deposits/Withdrawals': 'transfer',
    'Deposits & Withdrawals': 'transfer'
  };
  // Regelfall der Doppelbesteuerungsabkommen. Für die USA gesichert, für andere Länder im Bericht als Prüfpunkt ausgewiesen.
  const CREDIT_CAP_PERCENT = 15;
  const LEVEL_ORDER = { offen: 0, pruefen: 1, info: 2 };

  function typeKey(sec) {
    return sec.isin || 'conid:' + sec.conid;
  }

  function suggestType(sec) {
    if (sec.assetCategory === 'FUND') return 'fonds_offen';
    if (sec.assetCategory !== 'STK') return null;
    const sub = (sec.subCategory || '').toUpperCase();
    if (FUND_SUBCATEGORIES[sub]) return 'fonds_offen';
    if (STOCK_SUBCATEGORIES[sub]) return 'aktie';
    return 'unbekannt';
  }

  function resolveType(sec, userTypes) {
    const chosen = userTypes ? userTypes[typeKey(sec)] : null;
    if (chosen && SELECTABLE_TYPES.indexOf(chosen) >= 0) return { type: chosen, source: 'user' };
    return { type: suggestType(sec), source: 'auto' };
  }

  function secLabel(sec) {
    const name = sec.symbol || sec.description || ('conid ' + sec.conid);
    return sec.isin ? name + ' · ' + sec.isin : name;
  }

  function dayNumber(iso) {
    return Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
  }

  function isoFromDay(n) {
    return new Date(n * 86400000).toISOString().slice(0, 10);
  }

  /* ---------- Schritt 1: alle Dateien zu einem Datenbestand zusammenführen ---------- */

  function buildModel(statements) {
    const model = {
      statements: statements, accounts: [], trades: [], cash: [], corporateActions: [],
      securities: new Map(), years: [], rowsWithoutId: 0
    };
    const seen = { trade: new Set(), cash: new Set(), action: new Set() };
    const accounts = new Set();
    const years = new Set();

    function mergeSecurity(src) {
      if (!src || !src.conid) return;
      let sec = model.securities.get(src.conid);
      if (!sec) {
        sec = { conid: src.conid, isin: '', symbol: '', description: '', assetCategory: '', subCategory: '', currency: '' };
        model.securities.set(src.conid, sec);
      }
      ['isin', 'symbol', 'description', 'assetCategory', 'subCategory', 'currency'].forEach(function (f) {
        if (!sec[f] && src[f]) sec[f] = src[f];
      });
    }

    // Dieselbe Buchung kann in zwei Dateien stehen (überlappende Zeiträume, doppelt geladene Datei). Sie zählt einmal.
    function isNew(set, account, id) {
      if (!id) {
        model.rowsWithoutId++;
        return true;
      }
      const key = account + '|' + id;
      if (set.has(key)) return false;
      set.add(key);
      return true;
    }

    statements.forEach(function (st) {
      accounts.add(st.accountId);
      st.securities.forEach(mergeSecurity);
    });
    statements.forEach(function (st) {
      st.trades.forEach(function (t) {
        if (!isNew(seen.trade, t.account, t.id)) return;
        mergeSecurity(t);
        model.trades.push(t);
      });
      st.cash.forEach(function (c) {
        if (!isNew(seen.cash, c.account, c.id)) return;
        // Der Buchungstext einer Dividende ist kein Wertpapiername, deshalb ohne „description“.
        mergeSecurity({ conid: c.conid, isin: c.isin, symbol: c.symbol, assetCategory: c.assetCategory, subCategory: c.subCategory });
        model.cash.push(c);
      });
      st.corporateActions.forEach(function (a) {
        const id = a.id || [a.conid, a.sort, a.type, a.quantity].join('/');
        if (!isNew(seen.action, a.account, id)) return;
        model.corporateActions.push(a);
      });
      (st.openPositions || []).forEach(mergeSecurity);
      if (st.from && st.to) {
        for (let y = Number(st.from.slice(0, 4)); y <= Number(st.to.slice(0, 4)); y++) years.add(y);
      }
    });

    model.trades.sort(F.compareEvents);
    model.cash.sort(F.compareEvents);
    model.corporateActions.sort(F.compareEvents);
    model.trades.forEach(t => years.add(Number(t.date.slice(0, 4))));
    model.cash.forEach(c => years.add(Number(c.date.slice(0, 4))));
    model.accounts = Array.from(accounts).sort();
    model.years = Array.from(years).sort((a, b) => b - a);
    return model;
  }

  function statementsOverlap(model) {
    return model.statements.some(function (a, i) {
      return model.statements.some(function (b, j) {
        return j > i && a.accountId === b.accountId && a.from && b.from && a.from <= b.to && b.from <= a.to;
      });
    });
  }

  function coverageGaps(model, year) {
    const start = dayNumber(year + '-01-01');
    const end = dayNumber(year + '-12-31');
    const gaps = [];
    model.accounts.forEach(function (account) {
      const intervals = model.statements
        .filter(s => s.accountId === account && s.from && s.to)
        .map(s => [dayNumber(s.from), dayNumber(s.to)])
        .filter(i => i[1] >= start && i[0] <= end)
        .sort((a, b) => a[0] - b[0]);
      let cursor = start;
      intervals.forEach(function (i) {
        if (i[0] > cursor) gaps.push({ account: account, from: isoFromDay(cursor), to: isoFromDay(i[0] - 1) });
        cursor = Math.max(cursor, i[1] + 1);
      });
      if (cursor <= end) gaps.push({ account: account, from: isoFromDay(cursor), to: isoFromDay(end) });
    });
    return gaps;
  }

  /* ---------- Schritt 2: Bericht für ein Steuerjahr ---------- */

  // userPrices: vom Nutzer eingetragene Fondspreise je Anteil in Euro, { Wertpapier: { Kalenderjahr: { beginn, ende } } }.
  function buildReport(model, userTypes, yearInput, userPrices) {
    const year = Number(yearInput);
    const Y = String(year);
    const forms = K.forms.forYear(year);
    const warnings = [];
    const warn = (level, title, text, items) => warnings.push({ level: level, title: title, text: text, items: items || [] });
    const inYear = d => !!d && d.slice(0, 4) === Y;
    const secOf = conid => model.securities.get(conid) || { conid: conid, isin: '', symbol: '', description: '', assetCategory: '', subCategory: '' };
    const typeOf = conid => resolveType(secOf(conid), userTypes).type;
    const groupOf = function (conid) {
      const t = typeOf(conid);
      return t ? TYPES[t].group : null;
    };
    const isGerman = sec => (sec.isin || '').slice(0, 2) === 'DE';
    const sum = items => items.reduce((s, i) => s + i.cents, 0);
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const eur = cents => M.fmtCents(cents) + ' €';

    const tradeItem = function (t) {
      const verb = t.quantity < 0 ? 'Verkauf' : 'Kauf';
      return {
        date: t.date, security: secLabel(secOf(t.conid)), art: verb,
        text: verb + ', Menge ' + M.fmtNumber(Math.abs(t.quantity), 6) + ', Preis ' + M.fmtNumber(t.tradePrice, 6) + ' ' + t.currency,
        cents: null
      };
    };
    const cashItem = function (c, art, cents) {
      const converted = c.currency === 'EUR' ? '' : ' × Kurs ' + M.fmtNumber(c.fx, 6);
      return {
        date: c.date, security: c.conid ? secLabel(secOf(c.conid)) : '–', art: art,
        text: art + ' ' + M.fmtNumber(c.amount, 2, true) + ' ' + c.currency + converted,
        cents: cents
      };
    };
    const saleItem = function (res, r) {
      const lots = r.pieces.map(p => M.fmtQty(p.q) + ' Stk. vom ' + M.fmtDate(p.lotDate)).join(', ');
      return {
        date: r.trade.date, security: secLabel(res.sec), art: 'Verkauf',
        text: 'Verkauf ' + M.fmtQty(r.q) + ' Stk.: Erlös ' + eur(r.proceedsCents) + ' − Anschaffungskosten ' + eur(r.costCents) + ' (' + lots + ')',
        cents: r.gainCents
      };
    };

    /* --- FIFO je Depot und Wertpapier, über alle geladenen Jahre --- */

    const groups = new Map();
    model.trades.forEach(function (t) {
      if (!COMPUTED_ASSETS[t.assetCategory]) return;
      const key = t.account + '|' + t.conid;
      if (!groups.has(key)) groups.set(key, { account: t.account, conid: t.conid, events: [] });
      groups.get(key).events.push(t);
    });
    model.corporateActions.forEach(function (a) {
      const g = groups.get(a.account + '|' + a.conid);
      if (g) g.events.push(a);
    });

    const results = [];
    const unclassifiedTrades = [];
    groups.forEach(function (g) {
      const group = groupOf(g.conid);
      if (group !== 'aktie' && group !== 'fonds' && group !== 'fonds_offen') {
        if (group !== 'ignorieren') g.events.forEach(e => { if (e.kind === 'trade' && inYear(e.date)) unclassifiedTrades.push(tradeItem(e)); });
        return;
      }
      g.events.sort(F.compareEvents);
      const res = F.run(g.events);
      res.events = g.events;
      res.account = g.account;
      res.conid = g.conid;
      res.sec = secOf(g.conid);
      res.type = typeOf(g.conid);
      res.group = group;
      res.soldInYear = res.realizations.some(r => inYear(r.trade.date));
      res.tradedInYear = g.events.some(e => e.kind === 'trade' && inYear(e.date));
      results.push(res);
    });

    /* --- Verkäufe des Jahres --- */

    const stock = { gainsAusland: [], lossesAusland: [], gainsInland: [], lossesInland: [] };
    const fundSales = { offen: [] };
    const fundDistributions = { offen: [] };
    FUND_TYPES.forEach(function (t) {
      fundSales[t] = [];
      fundDistributions[t] = [];
    });
    const incompleteSales = [];
    const oldFundLots = [];
    let fundSaleCount = 0;

    results.forEach(function (res) {
      res.realizations.forEach(function (r) {
        if (!inYear(r.trade.date)) return;
        if (!r.complete) {
          incompleteSales.push({
            date: r.trade.date, security: secLabel(res.sec), art: 'Verkauf',
            text: 'Verkauf ' + M.fmtQty(r.q) + ' Stk., davon ohne Kaufdaten: ' + M.fmtQty(r.unmatchedQty + r.shortOpenedQty) + ' Stk.',
            cents: null, short: r.shortOpenedQty > 0
          });
          return;
        }
        const item = saleItem(res, r);
        if (res.group === 'aktie') {
          const inland = isGerman(res.sec);
          // Je Verkauf: ein Ergebnis über null zählt als Gewinn, darunter als Verlust.
          if (r.gainCents >= 0) (inland ? stock.gainsInland : stock.gainsAusland).push(item);
          else (inland ? stock.lossesInland : stock.lossesAusland).push(item);
        } else {
          fundSales[res.group === 'fonds' ? res.type : 'offen'].push(item);
          fundSaleCount++;
          if (r.pieces.some(p => p.lotDate < '2018-01-01')) oldFundLots.push(item);
        }
      });
    });

    /* --- Dividenden, Zinsen, Quellensteuer des Jahres --- */

    const dividends = [];
    const substitutePayments = [];
    const interest = [];
    const interestPaid = [];
    const fees = [];
    const germanDividends = [];
    const unknownCash = [];
    const unclassifiedCash = [];
    const bondInterest = [];
    const withholdingWithoutSecurity = [];
    const withheld = new Map();       // conid → einbehaltene Quellensteuer
    const grossBySecurity = new Map(); // conid → Bruttodividenden, auf die Quellensteuer angerechnet werden kann

    model.cash.forEach(function (c) {
      if (!inYear(c.date)) return;
      const kind = CASH_KINDS[c.type];
      const cents = M.toCents(c.amount * c.fx);
      if (kind === 'transfer') return;
      if (kind === 'dividend' || kind === 'pil') {
        if (!c.conid) {
          unknownCash.push(cashItem(c, c.type, cents));
          return;
        }
        const sec = secOf(c.conid);
        const group = groupOf(c.conid);
        const item = cashItem(c, kind === 'pil' ? 'Ersatzdividende' : 'Dividende', cents);
        if (group === 'aktie') {
          if (isGerman(sec)) {
            germanDividends.push(item);
          } else {
            (kind === 'pil' ? substitutePayments : dividends).push(item);
            grossBySecurity.set(c.conid, (grossBySecurity.get(c.conid) || 0) + cents);
          }
        } else if (group === 'fonds' || group === 'fonds_offen') {
          item.art = 'Ausschüttung';
          item.text = item.text.replace(/^(Dividende|Ersatzdividende)/, 'Ausschüttung');
          fundDistributions[group === 'fonds' ? typeOf(c.conid) : 'offen'].push(item);
        } else if (group !== 'ignorieren') {
          unclassifiedCash.push(item);
        }
      } else if (kind === 'wht') {
        if (!c.conid) {
          withholdingWithoutSecurity.push(cashItem(c, 'Quellensteuer', cents));
          return;
        }
        const entry = withheld.get(c.conid) || { conid: c.conid, cents: 0, country: '', lastDate: c.date };
        entry.cents += cents;
        entry.lastDate = c.date > entry.lastDate ? c.date : entry.lastDate;
        const m = /-\s*([A-Z]{2})\s+TAX\b/.exec(c.description || '');
        if (m && !entry.country) entry.country = m[1];
        withheld.set(c.conid, entry);
      } else if (kind === 'interest') {
        interest.push(cashItem(c, 'Zinsen', cents));
      } else if (kind === 'interestPaid') {
        interestPaid.push(cashItem(c, 'Sollzinsen', cents));
      } else if (kind === 'fee') {
        fees.push(cashItem(c, 'Gebühr', cents));
      } else if (kind === 'bond') {
        bondInterest.push(cashItem(c, 'Anleihezinsen', cents));
      } else {
        unknownCash.push(cashItem(c, c.type, cents));
      }
    });

    /* --- Anrechenbare ausländische Quellensteuer: je Wertpapier höchstens 15 % der Bruttodividende --- */

    const creditItems = [];
    const withholdingChecks = [];
    const germanWithholding = [];
    const fundWithholding = [];
    withheld.forEach(function (entry) {
      const sec = secOf(entry.conid);
      const group = groupOf(entry.conid);
      const country = entry.country || (sec.isin || '').slice(0, 2) || '??';
      const amount = -entry.cents; // positiv = einbehalten
      const base = { date: entry.lastDate, security: secLabel(sec), art: 'Quellensteuer ' + country };
      if (group === 'fonds' || group === 'fonds_offen') {
        fundWithholding.push(Object.assign(base, { text: 'einbehalten ' + eur(amount), cents: amount }));
        return;
      }
      if (group !== 'aktie') return;
      if (isGerman(sec) || country === 'DE') {
        germanWithholding.push(Object.assign(base, { text: 'einbehalten ' + eur(amount), cents: amount }));
        return;
      }
      const gross = grossBySecurity.get(entry.conid) || 0;
      const cap = Math.max(0, Math.round(gross * CREDIT_CAP_PERCENT / 100));
      const credit = Math.max(0, Math.min(amount, cap));
      const rate = gross > 0 ? amount / gross * 100 : 0;
      creditItems.push(Object.assign({}, base, {
        text: 'einbehalten ' + eur(amount) + ' auf Dividenden von ' + eur(gross) + ' (' + M.fmtNumber(rate, 1) + ' %), angerechnet höchstens ' + CREDIT_CAP_PERCENT + ' %',
        cents: credit
      }));
      const reasons = [];
      if (amount < 0) reasons.push('Im Jahr wurde mehr Quellensteuer erstattet als einbehalten.');
      if (amount > 0 && gross <= 0) reasons.push('Quellensteuer ohne Dividende im selben Jahr, nichts angerechnet.');
      if (gross > 0 && rate > CREDIT_CAP_PERCENT + 0.5) reasons.push('Einbehalten wurden ' + M.fmtNumber(rate, 1) + ' %. Der Teil über ' + CREDIT_CAP_PERCENT + ' % ist nicht angerechnet; er lässt sich oft im Quellenstaat zurückfordern.');
      if (amount > 0 && country !== 'US') reasons.push('Anrechenbaren Satz für ' + country + ' prüfen.');
      if (reasons.length) withholdingChecks.push(Object.assign({}, base, { text: reasons.join(' '), cents: credit }));
    });

    /* --- Vorabpauschale für das Vorjahr: gilt am ersten Werktag des Steuerjahres als zugeflossen (§ 18 Abs. 3 InvStG) --- */

    const vorabYear = year - 1;
    const vorabEnd = vorabYear + '-12-31';
    const vorabStart = (vorabYear - 1) + '-12-31';
    const prozent = K.forms.basisertragProzent(vorabYear);
    const vz = forms.kapinv.vorabRechnung;
    const vorabLines = { offen: [] };
    FUND_TYPES.forEach(function (t) {
      vorabLines[t] = [];
    });
    const vorabFunds = [];
    const vorabOpen = [];
    const vorabChecks = [];

    // Kurs je Anteil in Euro-Cent aus dem Abschnitt „Open Positions“ eines Auszugs, der genau an diesem Tag endet.
    const exportPrice = function (account, conid, isoDate) {
      let cents = null;
      model.statements.forEach(function (st) {
        if (st.accountId !== account || st.to !== isoDate || !st.openPositions) return;
        const p = st.openPositions.find(x => x.conid === conid);
        if (!p || !(p.markPrice > 0)) return;
        const fx = p.currency === 'EUR' ? 1 : p.fx;
        if (fx) cents = M.toCents(p.markPrice * fx);
      });
      return cents;
    };

    results.forEach(function (res) {
      if (res.group !== 'fonds' && res.group !== 'fonds_offen') return;
      const atEnd = F.run(res.events.filter(e => e.date <= vorabEnd));
      if (!atEnd.lots.length) return;
      const key = typeKey(res.sec);
      const base = { date: '', security: secLabel(res.sec), art: 'Vorabpauschale ' + vorabYear };
      const typed = (userPrices && userPrices[key] && userPrices[key][vorabYear]) || {};
      const fromExport = { beginn: exportPrice(res.account, res.conid, vorabStart), ende: exportPrice(res.account, res.conid, vorabEnd) };
      const price = function (which) {
        const cents = M.parseEuro(typed[which]);
        if (cents > 0) return { cents: cents, source: 'eingabe' };
        return { cents: fromExport[which], source: fromExport[which] === null ? '' : 'export' };
      };
      const beginn = price('beginn');
      const ende = price('ende');
      const fund = {
        key: key, security: base.security, exportBeginn: fromExport.beginn, exportEnde: fromExport.ende,
        eingabe: { beginn: typed.beginn || '', ende: typed.ende || '' }, status: '', cents: null
      };
      vorabFunds.push(fund);
      const open = function (status, text) {
        fund.status = status;
        vorabOpen.push(Object.assign({}, base, { text: text, cents: null }));
      };
      if (prozent === null) return open('prozentsatz', 'Der Prozentsatz für den Basisertrag ' + vorabYear + ' ist nicht hinterlegt.');
      if (atEnd.flags.missingHistory || atEnd.flags.short || atEnd.unprocessedActions.length) {
        return open('bestand', 'Der Bestand am ' + M.fmtDate(vorabEnd) + ' lässt sich nicht sicher nachrechnen (fehlende Käufe, Leerverkauf oder Kapitalmaßnahme).');
      }
      // Nach einem Split passen der Preis je Anteil zu Jahresbeginn und die Stückzahl am Jahresende nicht mehr zusammen.
      if (res.events.some(e => e.kind === 'corporateAction' && e.date.slice(0, 4) === String(vorabYear))) {
        return open('bestand', 'Im Jahr ' + vorabYear + ' gab es eine Kapitalmaßnahme. Die Vorabpauschale ist für diesen Fonds von Hand zu rechnen.');
      }
      if (beginn.cents === null || ende.cents === null) {
        const missing = [beginn.cents === null ? 'der Preis zu Jahresbeginn' : '', ende.cents === null ? 'der letzte Preis des Jahres' : ''].filter(Boolean).join(' und ');
        return open('preise', 'Für ' + vorabYear + ' fehlt ' + missing + '. Trage ihn unten unter „Fondspreise“ ein.');
      }

      // Ausschüttungen des Jahres je Anteil: aus dem Buchungstext, ersatzweise Betrag geteilt durch den Bestand am Zahltag.
      let perShare = 0;
      let estimated = false;
      model.cash.forEach(function (c) {
        if (c.account !== res.account || c.conid !== res.conid || c.date.slice(0, 4) !== String(vorabYear)) return;
        const kind = CASH_KINDS[c.type];
        if (kind !== 'dividend' && kind !== 'pil') return;
        const stated = K.vorab.ausschuettungJeAnteil(c.description, c.currency);
        const held = F.positionAt(res.timeline, c.date);
        if (stated !== null) perShare += (c.amount < 0 ? -1 : 1) * stated * c.fx;
        else if (held > 0) perShare += c.amount * c.fx * M.QTY_SCALE / held;
        if (stated === null) estimated = true;
      });
      const ausschuettung = Math.max(0, M.toCents(perShare));

      const columns = K.vorab.spalten(atEnd.lots, vorabYear);
      fund.cents = 0;
      fund.status = 'berechnet';
      columns.forEach(function (col) {
        const r = K.vorab.jeAnteil({ beginnCents: beginn.cents, endeCents: ende.cents, ausschuettungCents: ausschuettung, prozent: prozent, monate: col.monate });
        const cents = Math.round(r.ergebnis * col.q / M.QTY_SCALE);
        const bought = col.erwerb ? 'gekauft ' + col.erwerb.slice(5, 7) + '.' + col.erwerb.slice(0, 4) : 'gekauft vor ' + vorabYear;
        const step = (zeile, value) => 'Zeile ' + zeile + ': ' + M.fmtCents(value);
        fund.cents += cents;
        (res.group === 'fonds' ? vorabLines[res.type] : vorabLines.offen).push(Object.assign({}, base, {
          text: M.fmtQty(col.q) + ' Stk., ' + bought + ' · ' + [
            step(vz.preisBeginn, beginn.cents), step(vz.basisertrag, r.basisertrag), step(vz.letzterPreis, ende.cents),
            step(vz.ausschuettungen, ausschuettung), step(vz.mehrbetrag, r.mehrbetrag), step(vz.niedrigerer, r.niedrigerer),
            step(vz.zwischen, r.zwischen), step(vz.kuerzung, r.kuerzung), step(vz.jeAnteil, r.ergebnis)
          ].join(' · '),
          cents: cents
        }));
      });

      const check = text => vorabChecks.push(Object.assign({}, base, { text: text, cents: fund.cents }));
      if (beginn.source === 'export') {
        check('Preis zu Jahresbeginn (' + eur(beginn.cents) + ') ist der Schlusskurs vom ' + M.fmtDate(vorabStart) + ' aus dem Export. Maßgeblich ist der erste Preis des Jahres ' + vorabYear + '.');
      }
      if (estimated) check('Ausschüttung je Anteil (' + eur(ausschuettung) + ') aus Betrag und Bestand am Zahltag geschätzt, weil der Buchungstext keinen Betrag je Anteil nennt.');
      const distributing = model.cash.some(c => c.conid === res.conid && (CASH_KINDS[c.type] === 'dividend' || CASH_KINDS[c.type] === 'pil'));
      if (distributing && columns.some(col => col.monate > 0)) {
        check('Anteile wurden im Lauf des Jahres ' + vorabYear + ' gekauft. Ausschüttungen des Fonds vor dem Kauf stehen nicht im Export. Gab es welche, ist die Vorabpauschale zu hoch.');
      }
    });

    // Fonds, die laut IBKR am Jahresende im Depot lagen, zu denen aber keine Käufe geladen sind.
    model.statements.forEach(function (st) {
      if (st.to !== vorabEnd || !st.openPositions) return;
      st.openPositions.forEach(function (p) {
        const group = groupOf(p.conid);
        if (!(p.position > 0) || (group !== 'fonds' && group !== 'fonds_offen')) return;
        if (results.some(r => r.account === st.accountId && r.conid === p.conid)) return;
        vorabOpen.push({
          date: '', security: secLabel(secOf(p.conid)), art: 'Vorabpauschale ' + vorabYear,
          text: 'Bestand laut IBKR am ' + M.fmtDate(vorabEnd) + ', aber die Käufe fehlen in den geladenen Dateien.', cents: null
        });
      });
    });

    /* --- Formularzeilen --- */

    const line = function (form, number, label, items, note) {
      const sorted = items.slice().sort(byDate);
      return { form: form, line: String(number), label: label, cents: sum(sorted), items: sorted, note: note || '' };
    };
    const negate = items => items.map(i => Object.assign({}, i, { cents: -i.cents }));
    const kap = forms.kap;
    const both = 'In den Zeilen ' + kap.inland + ' und ' + kap.ausland + ' enthaltene ';

    const kapLines = [];
    const inlandItems = stock.gainsInland.concat(stock.lossesInland);
    if (inlandItems.length) {
      kapLines.push(line('KAP', kap.inland, 'Inländische Kapitalerträge ohne Steuerabzug (Saldo)', inlandItems, 'Verkäufe deutscher Aktien im Auslandsdepot.'));
    }
    kapLines.push(line('KAP', kap.ausland, 'Ausländische Kapitalerträge (Saldo aus Erträgen, Gewinnen und Verlusten)',
      dividends.concat(substitutePayments, interest, stock.gainsAusland, stock.lossesAusland)));
    kapLines.push(line('KAP', kap.aktiengewinne, both + 'Gewinne aus Aktienverkäufen', stock.gainsAusland.concat(stock.gainsInland)));
    kapLines.push(line('KAP', kap.aktienverluste, both + 'Verluste aus Aktienverkäufen', negate(stock.lossesAusland.concat(stock.lossesInland)), 'Als positiver Betrag einzutragen.'));
    kapLines.push(line('KAP', kap.auslaendischeSteuern, 'Anrechenbare, noch nicht angerechnete ausländische Steuern', creditItems));

    const invLines = [];
    FUND_TYPES.forEach(function (t) {
      if (fundDistributions[t].length) invLines.push(line('KAP-INV', forms.kapinv.ausschuettung[t], 'Ausschüttungen: ' + TYPES[t].label + ' (vor Teilfreistellung)', fundDistributions[t]));
      if (vorabLines[t].length) {
        invLines.push(line('KAP-INV', forms.kapinv.vorabpauschaleJeArt[t], 'Vorabpauschalen für ' + vorabYear + ': ' + TYPES[t].label + ' (vor Teilfreistellung)', vorabLines[t],
          'Rechenweg wie Zeilen ' + vz.preisBeginn + ' bis ' + vz.ergebnis + ' des Vordrucks.'));
      }
      if (fundSales[t].length) invLines.push(line('KAP-INV', forms.kapinv.veraeusserung[t], 'Gewinne und Verluste aus Verkäufen: ' + TYPES[t].label + ' (vor Teilfreistellung)', fundSales[t]));
    });
    invLines.sort((a, b) => Number(a.line) - Number(b.line));

    const pendingLines = [];
    if (fundDistributions.offen.length) pendingLines.push(line('', '?', 'Fondsausschüttungen, Fondsart noch offen', fundDistributions.offen));
    if (fundSales.offen.length) pendingLines.push(line('', '?', 'Gewinne und Verluste aus Fondsverkäufen, Fondsart noch offen', fundSales.offen));
    if (vorabLines.offen.length) pendingLines.push(line('', '?', 'Vorabpauschalen für ' + vorabYear + ', Fondsart noch offen', vorabLines.offen));

    const sections = [{ id: 'kap', title: 'Anlage KAP', lines: kapLines, note: 'Im Vordruck stehen die Zeilen ' + kap.inland + ' bis ' + kap.aktienverluste + ' in vollen Euro, Zeile ' + kap.auslaendischeSteuern + ' mit Cent.' }];
    if (invLines.length) sections.push({ id: 'kapinv', title: 'Anlage KAP-INV', lines: invLines, note: 'Beträge in voller Höhe eintragen, im Vordruck in vollen Euro. Die Teilfreistellung zieht das Finanzamt ab.' });
    if (pendingLines.length) sections.push({ id: 'offen', title: 'Berechnet, aber noch keiner Zeile zugeordnet', lines: pendingLines });

    /* --- Offene Punkte: Dinge, die in keiner Summe stecken --- */

    const gaps = coverageGaps(model, year);
    if (gaps.length) {
      warn('offen', 'Für ' + Y + ' fehlen Daten',
        'Die geladenen Dateien decken das Jahr nicht vollständig ab. Buchungen aus den fehlenden Zeiträumen sind nicht enthalten.',
        gaps.map(g => ({ date: g.from, security: 'Konto ' + g.account, art: 'Lücke', text: M.fmtDate(g.from) + ' bis ' + M.fmtDate(g.to), cents: null })));
    }
    const missingSections = model.statements.filter(s => s.from.slice(0, 4) <= Y && s.to.slice(0, 4) >= Y && !(s.sections.trades && s.sections.cash));
    if (missingSections.length) {
      warn('offen', 'Abschnitte fehlen im Export',
        'In mindestens einer Datei fehlt der Abschnitt „Trades“ oder „Cash Transactions“. Verkäufe oder Erträge daraus sind nicht enthalten.',
        missingSections.map(s => ({ date: s.from, security: s.file, art: 'Datei', text: (s.sections.trades ? '' : 'Trades fehlt. ') + (s.sections.cash ? '' : 'Cash Transactions fehlt.'), cents: null })));
    }

    const missingHistory = incompleteSales.filter(i => !i.short);
    if (missingHistory.length) {
      warn('offen', 'Kaufdaten fehlen',
        'Zu diesen Verkäufen stehen die Käufe nicht in den geladenen Dateien. Sie sind in keiner Summe enthalten. Lade zusätzlich die Exporte der früheren Jahre, zurück bis zum ersten Kauf.',
        missingHistory);
    }
    // Auch die Eindeckung zählt: ein im Vorjahr eröffneter Leerverkauf wird erst mit dem Rückkauf zum Ergebnis.
    const shortAffected = results.filter(r => r.flags.short && r.tradedInYear);
    if (shortAffected.length) {
      warn('offen', 'Leerverkäufe werden noch nicht berechnet',
        'Bei diesen Wertpapieren gab es Leerverkäufe oder deren Eindeckung. Ergebnisse daraus sind in keiner Summe enthalten.',
        shortAffected.map(r => ({ date: '', security: secLabel(r.sec), art: 'Leerverkauf', text: 'Leerverkauf oder Eindeckung in ' + Y, cents: null })));
    }

    const actionItem = a => ({ date: a.date, security: secLabel(secOf(a.conid)), art: 'Kapitalmaßnahme', text: a.description || a.type, cents: null });
    const blockingActions = [];
    const yearActions = [];
    results.forEach(function (res) {
      res.unprocessedActions.forEach(function (a) {
        if (res.soldInYear && res.realizations.some(r => inYear(r.trade.date) && r.trade.sort >= a.sort)) blockingActions.push(actionItem(a));
        else if (inYear(a.date)) yearActions.push(actionItem(a));
      });
    });
    model.corporateActions.forEach(function (a) {
      if (!inYear(a.date) || groups.has(a.account + '|' + a.conid)) return;
      if (COMPUTED_ASSETS[a.assetCategory]) yearActions.push(actionItem(a));
    });
    if (blockingActions.length) {
      warn('offen', 'Kapitalmaßnahme nicht verarbeitet',
        'Vor einem Verkauf gab es eine Kapitalmaßnahme, die diese Version nicht nachrechnet (verarbeitet werden nur Aktiensplits). Die Ergebnisse dieser Wertpapiere können falsch sein.',
        blockingActions);
    }

    const unsupportedByAsset = {};
    const currencyTrades = [];
    model.trades.forEach(function (t) {
      if (COMPUTED_ASSETS[t.assetCategory] || !inYear(t.date)) return;
      if (t.assetCategory === 'CASH') currencyTrades.push(tradeItem(t));
      else (unsupportedByAsset[t.assetCategory] = unsupportedByAsset[t.assetCategory] || []).push(tradeItem(t));
    });
    Object.keys(unsupportedByAsset).sort().forEach(function (asset) {
      const label = ASSET_LABELS[asset] || ('Anlageklasse ' + asset);
      const n = unsupportedByAsset[asset].length;
      warn('offen', label + ' werden noch nicht berechnet',
        (n === 1 ? '1 Geschäft in ' + Y + ' ist' : n + ' Geschäfte in ' + Y + ' sind') + ' in keiner Summe enthalten.', unsupportedByAsset[asset]);
    });

    if (unclassifiedTrades.length || unclassifiedCash.length) {
      warn('offen', 'Art des Wertpapiers fehlt',
        'Aus dem Export geht nicht hervor, ob es sich um eine Aktie oder einen Fonds handelt. Wähle die Art unten unter „Wertpapiere einordnen“. Bis dahin sind diese Buchungen nicht enthalten.',
        unclassifiedTrades.concat(unclassifiedCash));
    }
    if (pendingLines.length) {
      warn('offen', 'Fondsart fehlt',
        'Ausschüttungen, Vorabpauschalen und Verkäufe dieser Fonds sind berechnet, aber noch keiner Zeile zugeordnet. Wähle die Fondsart unten unter „Wertpapiere einordnen“.',
        fundDistributions.offen.concat(vorabLines.offen, fundSales.offen));
    }

    if (vorabOpen.length) {
      const vp = forms.kapinv.vorabpauschale;
      warn('offen', 'Vorabpauschale nicht berechnet',
        'Für Fonds, die du am ' + M.fmtDate(vorabEnd) + ' gehalten hast, kann eine Vorabpauschale anfallen (Anlage KAP-INV, Zeilen ' + vp.von + ' bis ' + vp.bis + '). Für diese Fonds ließ sie sich nicht berechnen.',
        vorabOpen);
    }

    if (germanDividends.length || germanWithholding.length) {
      warn('offen', 'Dividenden deutscher Aktien nicht enthalten',
        'Bei Dividenden deutscher Aktien wird deutsche Kapitalertragsteuer einbehalten. Sie gehören nicht in Zeile ' + kap.ausland + ', die Steuer nicht in Zeile ' + kap.auslaendischeSteuern + '. Diese Buchungen sind in keiner Summe enthalten.',
        germanDividends.concat(germanWithholding).sort(byDate));
    }
    if (bondInterest.length) warn('offen', 'Anleihezinsen werden noch nicht berechnet', 'Diese Buchungen sind in keiner Summe enthalten.', bondInterest);
    if (unknownCash.length) warn('offen', 'Unbekannte Buchungsart', 'Diese Buchungen kennt die Rechnung nicht. Sie sind in keiner Summe enthalten.', unknownCash);

    /* --- Bestandsabgleich: stimmt der nachgerechnete Bestand mit dem von IBKR gemeldeten überein? --- */

    const mismatches = [];
    let matched = 0;
    model.statements.forEach(function (st) {
      if (!st.openPositions || !st.to) return;
      const reported = new Map(st.openPositions.map(p => [p.conid, M.toQty(p.position)]));
      results.forEach(function (res) {
        if (res.account !== st.accountId) return;
        const ours = F.positionAt(res.timeline, st.to);
        const theirs = reported.get(res.conid) || 0;
        if (Math.abs(ours - theirs) <= 100) {
          matched++;
          return;
        }
        mismatches.push({
          date: st.to, security: secLabel(res.sec), art: 'Bestand',
          text: 'nachgerechnet ' + M.fmtQty(ours) + ' Stk., laut IBKR ' + M.fmtQty(theirs) + ' Stk.', cents: null, sold: res.soldInYear
        });
      });
    });
    if (mismatches.length) {
      warn(mismatches.some(m => m.sold) ? 'offen' : 'pruefen', 'Bestand weicht von IBKR ab',
        'Der aus den Käufen und Verkäufen nachgerechnete Bestand stimmt nicht mit dem Bestand im Export überein. Meist fehlen ältere Dateien oder eine Kapitalmaßnahme wurde nicht verarbeitet. Ergebnisse dieser Wertpapiere können falsch sein.',
        mismatches);
    }

    /* --- Prüfpunkte: berechnet, aber mit einer Annahme --- */

    if (!forms.exact) {
      warn('pruefen', 'Zeilennummern für ' + Y + ' nicht hinterlegt',
        'Angezeigt werden die Zeilennummern der Vordrucke ' + forms.basedOn + '. Die Nummern ändern sich zwischen den Jahren. Gleiche sie mit dem Vordruck ' + Y + ' ab.');
    }
    if (withholdingChecks.length) {
      warn('pruefen', 'Quellensteuer prüfen',
        'Angerechnet werden höchstens ' + CREDIT_CAP_PERCENT + ' % der Bruttodividende. Das ist der Regelfall der Doppelbesteuerungsabkommen, gilt aber nicht für jedes Land. Die Liste der anrechenbaren Sätze veröffentlicht das Bundeszentralamt für Steuern.',
        withholdingChecks);
    }
    if (withholdingWithoutSecurity.length) {
      warn('pruefen', 'Quellensteuer ohne Wertpapier', 'Diese Quellensteuer lässt sich keinem Wertpapier zuordnen (zum Beispiel Steuer auf Zinsen). Sie ist nicht angerechnet.', withholdingWithoutSecurity);
    }
    if (fundWithholding.length) {
      warn('pruefen', 'Quellensteuer auf Fondsausschüttungen', 'Diese Quellensteuer ist in Zeile ' + kap.auslaendischeSteuern + ' nicht enthalten. Ob und in welcher Höhe sie anrechenbar ist, bitte gesondert klären.', fundWithholding);
    }
    if (vorabChecks.length) {
      warn('pruefen', 'Vorabpauschale prüfen', 'Die Vorabpauschale für ' + vorabYear + ' ist bei diesen Fonds mit einer Annahme gerechnet.', vorabChecks);
    }
    if (fundSaleCount) {
      warn('pruefen', 'Fondsverkäufe ohne Abzug früherer Vorabpauschalen',
        'Bereits versteuerte Vorabpauschalen mindern den Gewinn beim Verkauf. Diese Version zieht sie nicht ab, der ausgewiesene Gewinn kann dadurch zu hoch sein.');
    }
    if (oldFundLots.length) {
      warn('pruefen', 'Fondsanteile von vor 2018', 'Für Anteile, die vor 2018 gekauft wurden, gelten Sonderregeln (fiktiver Verkauf zum 31.12.2017). Diese Version berücksichtigt sie nicht.', oldFundLots);
    }
    if (substitutePayments.length) {
      warn('pruefen', 'Ersatzdividenden', 'Ersatzzahlungen für verliehene Aktien sind wie Dividenden in Zeile ' + kap.ausland + ' enthalten.', substitutePayments);
    }
    if (currencyTrades.length) {
      warn('pruefen', 'Währungstausch',
        (currencyTrades.length === 1 ? '1 Währungsgeschäft' : currencyTrades.length + ' Währungsgeschäfte') + ' in ' + Y + '. Gewinne und Verluste aus Fremdwährungsguthaben berechnet diese Version nicht. Ob und wo sie zu erklären sind, bitte gesondert klären.',
        currencyTrades);
    }
    if (yearActions.length) {
      warn('pruefen', 'Kapitalmaßnahmen im Jahr', 'Diese Kapitalmaßnahmen wurden nicht bewertet. Manche (zum Beispiel Abspaltungen oder Aktiendividenden) können steuerpflichtig sein.', yearActions);
    }
    const flagged = (flag, title, text) => {
      const hit = results.filter(r => r.flags[flag] && r.soldInYear);
      if (hit.length) warn('pruefen', title, text, hit.map(r => ({ date: '', security: secLabel(r.sec), art: 'Hinweis', text: 'betrifft Verkäufe in ' + Y, cents: null })));
    };
    flagged('optionDelivery', 'Aktien aus Optionsgeschäften', 'Diese Aktien wurden über die Ausübung oder Zuteilung einer Option ge- oder verkauft. Die Optionsprämie ist in den Anschaffungskosten nicht berücksichtigt.');
    flagged('cancellation', 'Stornierte oder korrigierte Geschäfte', 'Bei diesen Wertpapieren gab es Storno- oder Korrekturbuchungen. Bitte die Ergebnisse mit dem Kontoauszug vergleichen.');
    flagged('commissionCurrency', 'Gebühr in dritter Währung', 'Die Gebühr wurde in einer anderen Währung als das Geschäft berechnet und näherungsweise umgerechnet.');
    flagged('splitRounding', 'Rundung nach Aktiensplit', 'Nach einem Split sind rechnerisch Bruchstücke entstanden. Bitte die Ergebnisse prüfen.');
    const reits = results.filter(r => r.soldInYear && (r.sec.subCategory || '').toUpperCase() === 'REIT' && r.group === 'aktie');
    if (reits.length) {
      warn('pruefen', 'REITs als Aktien behandelt', 'REITs werden hier wie Aktien gerechnet. Manche gelten steuerlich als Investmentfonds.',
        reits.map(r => ({ date: '', security: secLabel(r.sec), art: 'Hinweis', text: 'Einordnung prüfen', cents: null })));
    }
    const yearStatements = model.statements.filter(s => s.from.slice(0, 4) <= Y && s.to.slice(0, 4) >= Y);
    if (yearStatements.some(s => !s.baseCurrencyKnown)) {
      warn('pruefen', 'Basiswährung nicht im Export', 'Der Abschnitt „Account Information“ fehlt. Die Rechnung nimmt an, dass die Basiswährung des Kontos EUR ist.');
    }
    if (yearStatements.some(s => !s.sections.corporateActions)) {
      warn('pruefen', 'Kapitalmaßnahmen nicht im Export', 'Der Abschnitt „Corporate Actions“ fehlt in mindestens einer Datei. Aktiensplits können so nicht erkannt werden.');
    }
    if (model.rowsWithoutId && statementsOverlap(model)) {
      warn('pruefen', 'Mögliche Doppelzählung', 'Die Zeiträume der Dateien überschneiden sich und einzelnen Buchungen fehlt die Kennung. Doppelte Buchungen lassen sich so nicht sicher erkennen.');
    }

    /* --- Hinweise --- */

    if (interestPaid.length || fees.length) {
      warn('info', 'Nicht abziehbar',
        'Sollzinsen (' + eur(-sum(interestPaid)) + ') und Gebühren (' + eur(-sum(fees)) + ') mindern die Kapitalerträge nicht und sind nicht berücksichtigt.',
        interestPaid.concat(fees).sort(byDate));
    }
    if (matched && !mismatches.length) {
      warn('info', 'Bestandsabgleich stimmt', 'Der nachgerechnete Bestand stimmt in ' + matched + ' Fällen mit dem Bestand im Export überein.');
    }
    if (!yearStatements.some(s => s.openPositions)) {
      warn('info', 'Kein Bestandsabgleich möglich', 'Der Abschnitt „Open Positions“ fehlt. Mit ihm prüft die Rechnung, ob alle Käufe und Verkäufe geladen sind.');
    }

    warnings.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
    const counts = { offen: 0, pruefen: 0, info: 0 };
    warnings.forEach(w => { counts[w.level]++; });

    return {
      year: year, forms: forms, accounts: model.accounts, sections: sections, warnings: warnings,
      counts: counts, complete: counts.offen === 0,
      vorab: { year: vorabYear, funds: vorabFunds }
    };
  }

  /* ---------- Export ---------- */

  function toCsv(report) {
    const cell = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Formular', 'Zeile', 'Bezeichnung', 'Datum', 'Wertpapier', 'Vorgang', 'Betrag EUR']];
    report.sections.forEach(function (section) {
      section.lines.forEach(function (l) {
        rows.push([l.form, l.line, l.label, '', '', 'Summe', M.fmtCents(l.cents, true)]);
        l.items.forEach(i => rows.push([l.form, l.line, l.label, M.fmtDate(i.date), i.security, i.text, i.cents === null ? '' : M.fmtCents(i.cents, true)]));
      });
    });
    report.warnings.forEach(function (w) {
      const label = { offen: 'Offener Punkt', pruefen: 'Prüfpunkt', info: 'Hinweis' }[w.level];
      rows.push([label, '', w.title, '', '', w.text, '']);
      w.items.forEach(i => rows.push([label, '', w.title, M.fmtDate(i.date), i.security, i.text, i.cents === null || i.cents === undefined ? '' : M.fmtCents(i.cents, true)]));
    });
    return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
  }

  K.report = {
    buildModel: buildModel, buildReport: buildReport, toCsv: toCsv,
    resolveType: resolveType, typeKey: typeKey, secLabel: secLabel,
    TYPES: TYPES, FUND_TYPES: FUND_TYPES, SELECTABLE_TYPES: SELECTABLE_TYPES, COMPUTED_ASSETS: COMPUTED_ASSETS
  };
})(typeof window !== 'undefined' ? window : globalThis);
