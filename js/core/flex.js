/* Liest einen Activity-Flex-Query-Export von Interactive Brokers (XML) in einfache Datensätze ein.
   Fehlt ein Feld, das die Rechnung braucht, bricht das Einlesen mit einer verständlichen Meldung ab –
   ein stillschweigend angenommener Wert wäre bei Steuerzahlen schlimmer als ein Abbruch. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};
  const M = K.money;

  class FlexError extends Error {
    constructor(message) {
      super(message);
      this.name = 'FlexError';
    }
  }

  const FIELD_HINT = ' Bitte im Flex Query für diesen Abschnitt alle Felder auswählen.';
  const DATE_RE = /^(\d{4})-?(\d{2})-?(\d{2})(?:[;,T ]?\s*(\d{2}):?(\d{2}):?(\d{2}))?(?:\s+[A-Za-z][\w+\-:\/]*|\s*[+\-]\d{2}:?\d{2})?$/;

  function parseDate(raw, ctx) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    // „MULTI“ steht in Summenzeilen, die mehrere Tage zusammenfassen: dort gibt es kein einzelnes Datum.
    if (s === '' || s === 'MULTI') return null;
    const m = DATE_RE.exec(s);
    const month = m ? Number(m[2]) : 0;
    const day = m ? Number(m[3]) : 0;
    if (!m || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new FlexError((ctx ? ctx + ': ' : '') + 'Das Datum „' + s + '“ ist nicht lesbar. Bitte im Flex Query das Datumsformat „yyyyMMdd“ und das Zeitformat „HHmmss“ einstellen.');
    }
    const date = m[1] + '-' + m[2] + '-' + m[3];
    const time = m[4] ? m[4] + ':' + m[5] + ':' + m[6] : '';
    return { date: date, time: time, sort: date + 'T' + (time || '00:00:00') };
  }

  function attr(el, name) {
    const v = el.getAttribute(name);
    return v === null ? '' : v.trim();
  }

  function num(el, name, ctx, required) {
    const raw = el.getAttribute(name);
    const n = M.parseDec(raw);
    if (n === null) {
      if (required) throw new FlexError(ctx + ': Das Feld „' + name + '“ fehlt.' + FIELD_HINT);
      return 0;
    }
    if (Number.isNaN(n)) throw new FlexError(ctx + ': Das Feld „' + name + '“ enthält keine Zahl („' + raw + '“).');
    return n;
  }

  function child(el, name) {
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.nodeName === name) return c;
    return null;
  }

  function children(el, names) {
    const out = [];
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (names.indexOf(c.nodeName) >= 0) out.push(c);
    return out;
  }

  function isin(el) {
    return attr(el, 'isin') || (attr(el, 'securityIDType') === 'ISIN' ? attr(el, 'securityID') : '');
  }

  function security(el) {
    return {
      conid: attr(el, 'conid'), isin: isin(el), symbol: attr(el, 'symbol'), description: attr(el, 'description'),
      assetCategory: attr(el, 'assetCategory'), subCategory: attr(el, 'subCategory'), currency: attr(el, 'currency')
    };
  }

  function required(el, name, ctx) {
    const v = attr(el, name);
    if (!v) throw new FlexError(ctx + ': Das Feld „' + name + '“ fehlt.' + FIELD_HINT);
    return v;
  }

  function rate(el, ctx) {
    const fx = num(el, 'fxRateToBase', ctx, true);
    if (!(fx > 0)) throw new FlexError(ctx + ': Der Umrechnungskurs „fxRateToBase“ ist ungültig (' + fx + ').');
    return fx;
  }

  function tradeFromEl(e, st, seq) {
    const symbol = attr(e, 'symbol');
    const ctx = 'Abschnitt Trades, Zeile ' + (seq + 1) + (symbol ? ' (' + symbol + ')' : '');
    const tradeDate = parseDate(attr(e, 'tradeDate'), ctx);
    const dateTime = parseDate(attr(e, 'dateTime'), ctx);
    const when = tradeDate || dateTime;
    if (!when) throw new FlexError(ctx + ': Das Handelsdatum fehlt (Feld „tradeDate“ oder „dateTime“).' + FIELD_HINT);
    const orderId = attr(e, 'ibOrderID');
    const sec = security(e);
    sec.conid = required(e, 'conid', ctx);
    sec.assetCategory = required(e, 'assetCategory', ctx);
    sec.currency = required(e, 'currency', ctx);
    return Object.assign(sec, {
      kind: 'trade', account: attr(e, 'accountId') || st.accountId, file: st.file, fileSeq: st.fileSeq, seq: seq,
      id: attr(e, 'tradeID') || attr(e, 'transactionID') || attr(e, 'ibExecID') || (orderId ? 'order:' + orderId : ''),
      // Maßgeblich für Steuerjahr und Umrechnung ist der Handelstag, nicht die Wertstellung.
      date: when.date, sort: when.date + 'T' + (dateTime && dateTime.time ? dateTime.time : '00:00:00'),
      fx: rate(e, ctx),
      quantity: num(e, 'quantity', ctx, true), proceeds: num(e, 'proceeds', ctx, true),
      commission: num(e, 'ibCommission', ctx, false), commissionCurrency: attr(e, 'ibCommissionCurrency'),
      taxes: num(e, 'taxes', ctx, false), tradePrice: num(e, 'tradePrice', ctx, false),
      buySell: attr(e, 'buySell'), openClose: attr(e, 'openCloseIndicator'), notes: attr(e, 'notes'),
      transactionType: attr(e, 'transactionType')
    });
  }

  function cashFromEl(e, st, seq) {
    const ctx = 'Abschnitt Cash Transactions, Zeile ' + (seq + 1);
    // Zufluss: der Tag der Gutschrift entscheidet über das Steuerjahr.
    const when = parseDate(attr(e, 'settleDate'), ctx) || parseDate(attr(e, 'dateTime'), ctx) || parseDate(attr(e, 'reportDate'), ctx);
    if (!when) throw new FlexError(ctx + ': Das Buchungsdatum fehlt.' + FIELD_HINT);
    return {
      kind: 'cash', account: attr(e, 'accountId') || st.accountId, file: st.file, fileSeq: st.fileSeq, seq: seq,
      id: attr(e, 'transactionID'), date: when.date, sort: when.sort,
      type: required(e, 'type', ctx), amount: num(e, 'amount', ctx, true),
      currency: required(e, 'currency', ctx), fx: rate(e, ctx),
      conid: attr(e, 'conid'), isin: isin(e), symbol: attr(e, 'symbol'), description: attr(e, 'description'),
      assetCategory: attr(e, 'assetCategory'), subCategory: attr(e, 'subCategory')
    };
  }

  function corporateActionFromEl(e, st, seq) {
    const ctx = 'Abschnitt Corporate Actions, Zeile ' + (seq + 1);
    const when = parseDate(attr(e, 'dateTime'), ctx) || parseDate(attr(e, 'reportDate'), ctx);
    if (!when) throw new FlexError(ctx + ': Das Datum fehlt.' + FIELD_HINT);
    return {
      kind: 'corporateAction', account: attr(e, 'accountId') || st.accountId, file: st.file, fileSeq: st.fileSeq, seq: seq,
      id: attr(e, 'transactionID'), date: when.date, sort: when.sort, type: attr(e, 'type'),
      conid: attr(e, 'conid'), isin: isin(e), symbol: attr(e, 'symbol'),
      description: attr(e, 'actionDescription') || attr(e, 'description'),
      quantity: num(e, 'quantity', ctx, false),
      assetCategory: attr(e, 'assetCategory'), subCategory: attr(e, 'subCategory')
    };
  }

  // IBKR liefert je nach Einstellung dieselben Vorgänge mehrfach in verschiedenen Detailstufen.
  // Es zählt genau eine Stufe, sonst würde doppelt gerechnet.
  function pickLevel(rows, preferred, fallback) {
    const level = r => attr(r, 'levelOfDetail');
    const best = rows.filter(r => level(r) === '' || level(r) === preferred);
    return best.length ? best : rows.filter(r => level(r) === fallback);
  }

  function openPositionsFrom(sectionEl) {
    const rows = pickLevel(children(sectionEl, ['OpenPosition']), 'SUMMARY', 'LOT');
    const byConid = new Map();
    rows.forEach(function (r, i) {
      const conid = attr(r, 'conid');
      if (!conid) return;
      const entry = byConid.get(conid) || Object.assign(security(r), { position: 0, markPrice: 0, fx: null });
      entry.position += num(r, 'position', 'Abschnitt Open Positions, Zeile ' + (i + 1), true);
      // Kurs am Stichtag in der Währung des Wertpapiers und Umrechnungskurs: Grundlage für die Vorabpauschale.
      const mark = M.parseDec(r.getAttribute('markPrice'));
      if (mark > 0) entry.markPrice = mark;
      const fx = M.parseDec(r.getAttribute('fxRateToBase'));
      if (fx > 0) entry.fx = fx;
      byConid.set(conid, entry);
    });
    return Array.from(byConid.values());
  }

  function parseStatement(stEl, fileName, fileSeq) {
    const st = {
      file: fileName, fileSeq: fileSeq, accountId: attr(stEl, 'accountId') || 'unbekannt',
      from: '', to: '', baseCurrency: '', baseCurrencyKnown: false,
      trades: [], cash: [], corporateActions: [], securities: [], openPositions: null,
      sections: { trades: false, cash: false, corporateActions: false, openPositions: false }
    };
    const from = parseDate(attr(stEl, 'fromDate'), 'Zeitraum');
    const to = parseDate(attr(stEl, 'toDate'), 'Zeitraum');
    st.from = from ? from.date : '';
    st.to = to ? to.date : '';

    const info = child(stEl, 'AccountInformation');
    if (info && attr(info, 'currency')) {
      st.baseCurrency = attr(info, 'currency');
      st.baseCurrencyKnown = true;
    }

    const tradesEl = child(stEl, 'Trades');
    if (tradesEl) {
      st.sections.trades = true;
      const rows = children(tradesEl, ['Trade', 'Order']);
      const level = r => attr(r, 'levelOfDetail');
      const executions = rows.filter(r => r.nodeName === 'Trade' && (level(r) === '' || level(r) === 'EXECUTION'));
      const orders = rows.filter(r => level(r) === 'ORDER' || (r.nodeName === 'Order' && level(r) === ''));
      (executions.length ? executions : orders).forEach((e, i) => st.trades.push(tradeFromEl(e, st, i)));
    }

    const cashEl = child(stEl, 'CashTransactions');
    if (cashEl) {
      st.sections.cash = true;
      pickLevel(children(cashEl, ['CashTransaction']), 'DETAIL', 'SUMMARY').forEach((e, i) => st.cash.push(cashFromEl(e, st, i)));
    }

    const caEl = child(stEl, 'CorporateActions');
    if (caEl) {
      st.sections.corporateActions = true;
      pickLevel(children(caEl, ['CorporateAction']), 'DETAIL', 'SUMMARY').forEach((e, i) => st.corporateActions.push(corporateActionFromEl(e, st, i)));
    }

    const secEl = child(stEl, 'SecuritiesInfo');
    if (secEl) children(secEl, ['SecurityInfo']).forEach(e => { if (attr(e, 'conid')) st.securities.push(security(e)); });

    const opEl = child(stEl, 'OpenPositions');
    if (opEl) {
      st.sections.openPositions = true;
      st.openPositions = openPositionsFrom(opEl);
    }

    if (!st.sections.trades && !st.sections.cash) {
      throw new FlexError('Konto ' + st.accountId + ': Die Datei enthält weder den Abschnitt „Trades“ noch „Cash Transactions“. Bitte beide im Flex Query auswählen.');
    }

    checkBaseCurrency(st);
    return st;
  }

  // Alle Umrechnungen nutzen den Kurs „in die Basiswährung“. Nur wenn die Basiswährung EUR ist, sind das Euro-Werte.
  function checkBaseCurrency(st) {
    const rows = st.trades.concat(st.cash);
    if (!st.baseCurrencyKnown) {
      const euroRowWithRate = rows.find(r => r.currency === 'EUR' && Math.abs(r.fx - 1) > 1e-9);
      st.baseCurrency = euroRowWithRate ? 'nicht EUR' : 'EUR';
    }
    if (st.baseCurrency !== 'EUR') {
      throw new FlexError('Konto ' + st.accountId + ': Die Basiswährung des Kontos ist ' + st.baseCurrency + '. Diese Version rechnet nur Konten mit Basiswährung EUR.');
    }
  }

  function parse(xmlText, fileName, fileSeq) {
    if (typeof DOMParser === 'undefined') throw new FlexError('Dieser Browser kann keine XML-Dateien lesen.');
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new FlexError('Die Datei ist kein gültiges XML. Bitte den Flex Query im Format XML exportieren, nicht als CSV oder Text.');
    }
    const rootEl = doc.documentElement;
    if (!rootEl || rootEl.nodeName !== 'FlexQueryResponse') {
      throw new FlexError('Das ist kein Flex-Query-Export von Interactive Brokers. Erwartet wird eine XML-Datei, die mit <FlexQueryResponse> beginnt.');
    }
    const statementEls = Array.from(doc.getElementsByTagName('FlexStatement'));
    if (!statementEls.length) throw new FlexError('Die Datei enthält keinen Kontoauszug (kein <FlexStatement>).');
    return statementEls.map(el => parseStatement(el, fileName || 'Datei', fileSeq || 0));
  }

  K.flex = { parse: parse, parseDate: parseDate, FlexError: FlexError };
})(typeof window !== 'undefined' ? window : globalThis);
