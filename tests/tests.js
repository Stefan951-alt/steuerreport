/* Tests für den Rechenkern. Alle Erwartungswerte sind von Hand gerechnet, die Rechnung steht jeweils im Kommentar.
   Beträge in Cent. Aufruf: tests.html im Browser öffnen. */
(function () {
  'use strict';
  const K = window.KapReport;
  const M = K.money;
  const results = [];
  let counter = 5000;

  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, ok: true });
    } catch (e) {
      results.push({ name: name, ok: false, error: String((e && e.message) || e) });
    }
  }
  function eq(actual, expected, what) {
    if (actual !== expected) throw new Error((what || 'Wert') + ': erwartet ' + JSON.stringify(expected) + ', erhalten ' + JSON.stringify(actual));
  }
  function ok(condition, what) {
    if (!condition) throw new Error(what || 'Bedingung nicht erfüllt');
  }
  function throws(fn, pattern, what) {
    try {
      fn();
    } catch (e) {
      if (!pattern.test(e.message)) throw new Error((what || 'Fehlermeldung') + ' passt nicht: ' + e.message);
      return;
    }
    throw new Error((what || 'Aufruf') + ': Fehler erwartet, aber keiner aufgetreten');
  }

  /* ---------- Bausteine für kleine Flex-Dateien ---------- */

  function attrs(obj) {
    return Object.keys(obj).filter(k => obj[k] !== null && obj[k] !== undefined).map(function (k) {
      return ' ' + k + '="' + String(obj[k]).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"';
    }).join('');
  }
  function trade(o) {
    const d = Object.assign({
      accountId: 'U1', currency: 'EUR', fxRateToBase: '1', assetCategory: 'STK', subCategory: 'COMMON', symbol: 'AAA',
      description: 'AAA INC', conid: '1', isin: 'US0000000001', tradeDate: '20250110', quantity: '0', tradePrice: '1',
      proceeds: '0', taxes: '0', ibCommission: '0', notes: '', levelOfDetail: 'EXECUTION'
    }, o);
    if (d.tradeID === undefined) d.tradeID = String(++counter);
    if (d.dateTime === undefined) d.dateTime = d.tradeDate + ';120000';
    if (d.ibCommissionCurrency === undefined) d.ibCommissionCurrency = d.currency;
    if (d.buySell === undefined) d.buySell = Number(d.quantity) < 0 ? 'SELL' : 'BUY';
    if (d.openCloseIndicator === undefined) d.openCloseIndicator = Number(d.quantity) < 0 ? 'C' : 'O';
    return '<Trade' + attrs(d) + '/>';
  }
  function cash(o) {
    const d = Object.assign({
      accountId: 'U1', currency: 'EUR', fxRateToBase: '1', assetCategory: 'STK', subCategory: 'COMMON', symbol: 'AAA',
      description: 'AAA(US0000000001) CASH DIVIDEND', conid: '1', isin: 'US0000000001', settleDate: '20250615',
      amount: '0', type: 'Dividends', levelOfDetail: 'DETAIL'
    }, o);
    if (d.transactionID === undefined) d.transactionID = String(++counter);
    return '<CashTransaction' + attrs(d) + '/>';
  }
  function action(o) {
    const d = Object.assign({
      accountId: 'U1', currency: 'EUR', assetCategory: 'STK', subCategory: 'COMMON', symbol: 'AAA', conid: '1',
      isin: 'US0000000001', dateTime: '20240601;202500', reportDate: '20240601', quantity: '0', type: 'FS',
      actionDescription: 'AAA SPLIT', levelOfDetail: 'DETAIL'
    }, o);
    if (d.transactionID === undefined) d.transactionID = String(++counter);
    return '<CorporateAction' + attrs(d) + '/>';
  }
  function position(o) {
    const d = Object.assign({ accountId: 'U1', assetCategory: 'STK', subCategory: 'COMMON', symbol: 'AAA', conid: '1', isin: 'US0000000001', position: '0', levelOfDetail: 'SUMMARY' }, o);
    return '<OpenPosition' + attrs(d) + '/>';
  }
  function statement(o) {
    const d = Object.assign({ account: 'U1', year: 2025, base: 'EUR', trades: [], cash: [], actions: [], positions: null }, o);
    const from = d.from || d.year + '0101';
    const to = d.to || d.year + '1231';
    return '<FlexQueryResponse queryName="t" type="AF"><FlexStatements count="1">' +
      '<FlexStatement' + attrs({ accountId: d.account, fromDate: from, toDate: to }) + '>' +
      (d.base ? '<AccountInformation' + attrs({ accountId: d.account, currency: d.base }) + '/>' : '') +
      '<Trades>' + d.trades.join('') + '</Trades>' +
      '<CashTransactions>' + d.cash.join('') + '</CashTransactions>' +
      '<CorporateActions>' + d.actions.join('') + '</CorporateActions>' +
      (d.positions ? '<OpenPositions>' + d.positions.join('') + '</OpenPositions>' : '') +
      '</FlexStatement></FlexStatements></FlexQueryResponse>';
  }
  function run(xmls, year, types, prices) {
    const statements = [];
    xmls.forEach((xml, i) => K.flex.parse(xml, 'datei' + (i + 1) + '.xml', i + 1).forEach(s => statements.push(s)));
    return K.report.buildReport(K.report.buildModel(statements), types || {}, year, prices || {});
  }
  function lineCents(report, form, number) {
    let found;
    report.sections.forEach(s => s.lines.forEach(l => { if (l.form === form && l.line === String(number)) found = l.cents; }));
    return found;
  }
  function warning(report, pattern, level) {
    return report.warnings.find(w => pattern.test(w.title) && (!level || w.level === level));
  }

  /* ---------- Grundbausteine ---------- */

  test('Rundung: halbe Cent kaufmännisch, auch bei Darstellungsfehlern', function () {
    eq(M.toCents(1.005), 101);
    eq(M.toCents(-1.005), -101);
    eq(M.toCents(570.475), 57048);
    eq(M.toCents(0), 0);
    eq(M.toCents(-0.001), 0);
  });

  test('Eingabe von Euro-Beträgen: Komma und Punkt, Mehrdeutiges wird abgelehnt', function () {
    eq(M.parseEuro('88,50'), 8850);
    eq(M.parseEuro('1.234,56'), 123456);
    eq(M.parseEuro('88.5'), 8850);
    eq(M.parseEuro(' 100 € '), 10000);
    eq(M.parseEuro(''), null);
    ok(Number.isNaN(M.parseEuro('1.234')), '1.234 ist mehrdeutig');
    ok(Number.isNaN(M.parseEuro('abc')), 'Text ist kein Betrag');
    ok(Number.isNaN(M.parseEuro('-5')), 'negative Preise gibt es nicht');
  });

  test('Formatierung deutscher Beträge', function () {
    eq(M.fmtCents(123456), '1.234,56');
    eq(M.fmtCents(-5), '−0,05');
    eq(M.fmtCents(-123456, true), '-1234,56');
    eq(M.fmtDate('2025-03-14'), '14.03.2025');
    eq(M.fmtQty(M.toQty(0.25)), '0,25');
  });

  test('Datumsformate des Flex Query', function () {
    eq(K.flex.parseDate('20250115;103000').sort, '2025-01-15T10:30:00');
    eq(K.flex.parseDate('2025-01-15').date, '2025-01-15');
    eq(K.flex.parseDate('2025-01-15, 10:30:00').sort, '2025-01-15T10:30:00');
    eq(K.flex.parseDate('20250115;103000 EST').date, '2025-01-15');
    eq(K.flex.parseDate(''), null);
    throws(() => K.flex.parseDate('01/15/2025'), /nicht lesbar/);
    throws(() => K.flex.parseDate('20251340'), /nicht lesbar/);
  });

  // Diese drei Fälle stammen aus dem Abgleich mit der Formatbeschreibung des Open-Source-Projekts ibflex.
  // Kauf 1.000 €, Verkauf 1.100 €: Gewinn 100 €.
  test('Datum „MULTI“ und unbekanntes Eröffnungskennzeichen „-“ stören die Rechnung nicht', function () {
    eq(K.flex.parseDate('MULTI'), null);
    const r = run([statement({ trades: [
      trade({ tradeDate: '20250110', dateTime: 'MULTI', quantity: '10', proceeds: '-1000', openCloseIndicator: '-' }),
      trade({ tradeDate: '20250610', quantity: '-10', proceeds: '1100', openCloseIndicator: '-' })
    ] })], 2025);
    eq(lineCents(r, 'KAP', 20), 10000);
    eq(r.complete, true);
  });

  test('Aktien aus automatischer Optionsausübung und Korrekturbuchungen werden als Prüfpunkt gemeldet', function () {
    const exercised = run([statement({ trades: [
      trade({ tradeDate: '20250110', quantity: '10', proceeds: '-1000', notes: 'AEx;O', transactionType: 'BookTrade' }),
      trade({ tradeDate: '20250610', quantity: '-10', proceeds: '1100' })
    ] })], 2025);
    ok(warning(exercised, /Aktien aus Optionsgeschäften/, 'pruefen'), 'Prüfpunkt Option fehlt');
    const corrected = run([statement({ trades: [
      trade({ tradeDate: '20250110', quantity: '10', proceeds: '-1000', transactionType: 'TradeCorrect' }),
      trade({ tradeDate: '20250610', quantity: '-10', proceeds: '1100' })
    ] })], 2025);
    ok(warning(corrected, /Stornierte oder korrigierte/, 'pruefen'), 'Prüfpunkt Korrektur fehlt');
  });

  test('Kein Flex-Export: verständliche Fehlermeldung', function () {
    throws(() => K.flex.parse('Datum;Betrag\n1;2', 'x.csv', 1), /kein gültiges XML/);
    throws(() => K.flex.parse('<html></html>', 'x.xml', 1), /kein Flex-Query-Export/);
  });

  /* ---------- FIFO ---------- */

  // Kauf 1: (1000 + 1) USD × 0,90 = 900,90 €.  Kauf 2: (1200 + 1) USD × 0,95 = 1.140,95 €.
  // Verkauf 15 Stk.: (2250 − 1,50) USD × 0,92 = 2.068,62 €.
  // 10 Stk. aus Kauf 1: Erlös 2.068,62 × 10/15 = 1.379,08 − 900,90 = 478,18.
  // 5 Stk. aus Kauf 2: Erlös 689,54 − Kosten 1.140,95 / 2 = 570,48 (aufgerundet) = 119,06.  Summe 597,24.
  const fifoFiles = [
    statement({ year: 2024, trades: [
      trade({ currency: 'USD', fxRateToBase: '0.9', tradeDate: '20240110', quantity: '10', proceeds: '-1000', ibCommission: '-1' }),
      trade({ currency: 'USD', fxRateToBase: '0.95', tradeDate: '20240210', quantity: '10', proceeds: '-1200', ibCommission: '-1' })
    ] }),
    statement({ year: 2025, trades: [
      trade({ currency: 'USD', fxRateToBase: '0.92', tradeDate: '20250310', quantity: '-15', proceeds: '2250', ibCommission: '-1.5' })
    ] })
  ];

  test('FIFO über zwei Käufe mit Umrechnung zum jeweiligen Tageskurs', function () {
    const r = run(fifoFiles, 2025);
    eq(lineCents(r, 'KAP', 19), 59724, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 59724, 'Zeile 20');
    eq(lineCents(r, 'KAP', 23), 0, 'Zeile 23');
    eq(lineCents(r, 'KAP', 41), 0, 'Zeile 41');
    eq(r.complete, true, 'vollständig');
  });

  test('Käufe aus dem Vorjahr zählen nur für die Kosten, nicht als Ertrag des Vorjahres', function () {
    eq(lineCents(run(fifoFiles, 2024), 'KAP', 19), 0);
  });

  test('Reihenfolge der Dateien ist egal', function () {
    eq(lineCents(run([fifoFiles[1], fifoFiles[0]], 2025), 'KAP', 19), 59724);
  });

  test('Doppelt geladene Datei zählt einmal', function () {
    eq(lineCents(run([fifoFiles[0], fifoFiles[1], fifoFiles[1]], 2025), 'KAP', 19), 59724);
  });

  // Kauf 1.000 + 1 = 1.001,00 €.  Verkauf 900 − 1 = 899,00 €.  Verlust 102,00 €.
  test('Aktienverlust: Zeile 23 positiv, Zeile 19 negativ', function () {
    const r = run([statement({ trades: [
      trade({ tradeDate: '20250110', quantity: '10', proceeds: '-1000', ibCommission: '-1' }),
      trade({ tradeDate: '20250610', quantity: '-10', proceeds: '900', ibCommission: '-1' })
    ] })], 2025);
    eq(lineCents(r, 'KAP', 19), -10200, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 0, 'Zeile 20');
    eq(lineCents(r, 'KAP', 23), 10200, 'Zeile 23');
  });

  // Bruchstücke: 0,5 Stk. für 50 €, 0,25 Stk. für 30 €, Verkauf 0,6 Stk. für 90 €.
  // 0,5 Stk.: Erlös 75 − 50 = 25.  0,1 Stk.: Erlös 15 − 30 × 0,1/0,25 = 12 → 3.  Summe 28,00 €.
  test('Bruchstücke von Aktien', function () {
    const r = run([statement({ trades: [
      trade({ tradeDate: '20250110', quantity: '0.5', proceeds: '-50' }),
      trade({ tradeDate: '20250210', quantity: '0.25', proceeds: '-30' }),
      trade({ tradeDate: '20250310', quantity: '-0.6', proceeds: '90' })
    ] })], 2025);
    eq(lineCents(r, 'KAP', 20), 2800);
  });

  // Gebühr in EUR bei einem USD-Geschäft: Kauf 1000 USD × 0,9 + 2 € = 902 €.  Verkauf 1100 USD × 0,9 − 2 € = 988 €.  Gewinn 86 €.
  test('Gebühr in Euro bei Geschäft in Fremdwährung', function () {
    const r = run([statement({ trades: [
      trade({ currency: 'USD', fxRateToBase: '0.9', tradeDate: '20250110', quantity: '10', proceeds: '-1000', ibCommission: '-2', ibCommissionCurrency: 'EUR' }),
      trade({ currency: 'USD', fxRateToBase: '0.9', tradeDate: '20250610', quantity: '-10', proceeds: '1100', ibCommission: '-2', ibCommissionCurrency: 'EUR' })
    ] })], 2025);
    eq(lineCents(r, 'KAP', 20), 8600);
  });

  // 10 Stk. für 1.000 €, Split 2:1 (+10 Stk.), Verkauf 20 Stk. für 1.200 €: Gewinn 200 €.
  test('Aktiensplit verteilt die Anschaffungskosten, ohne Gewinn auszulösen', function () {
    const r = run([
      statement({ year: 2024, trades: [trade({ tradeDate: '20240110', quantity: '10', proceeds: '-1000' })], actions: [action({ quantity: '10' })] }),
      statement({ year: 2025, trades: [trade({ tradeDate: '20250115', quantity: '-20', proceeds: '1200' })] })
    ], 2025);
    eq(lineCents(r, 'KAP', 20), 20000);
    eq(r.complete, true);
  });

  test('Andere Kapitalmaßnahme vor einem Verkauf: offener Punkt', function () {
    const r = run([
      statement({ year: 2024, trades: [trade({ tradeDate: '20240110', quantity: '10', proceeds: '-1000' })], actions: [action({ quantity: '2', type: 'SD' })] }),
      statement({ year: 2025, trades: [trade({ tradeDate: '20250115', quantity: '-10', proceeds: '1200' })] })
    ], 2025);
    ok(warning(r, /Kapitalmaßnahme nicht verarbeitet/, 'offen'), 'Warnung fehlt');
    eq(r.complete, false);
  });

  test('Verkauf ohne Kaufdaten steht in keiner Summe', function () {
    const r = run([statement({ trades: [trade({ tradeDate: '20250310', quantity: '-5', proceeds: '700' })] })], 2025);
    eq(lineCents(r, 'KAP', 19), 0, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 0, 'Zeile 20');
    ok(warning(r, /Kaufdaten fehlen/, 'offen'), 'Warnung fehlt');
    eq(r.complete, false);
  });

  test('Leerverkauf wird nicht gerechnet, aber gemeldet', function () {
    const r = run([statement({ trades: [trade({ tradeDate: '20250310', quantity: '-5', proceeds: '700', openCloseIndicator: 'O' })] })], 2025);
    eq(lineCents(r, 'KAP', 19), 0);
    ok(warning(r, /Leerverkäufe/, 'offen'), 'Warnung fehlt');
    ok(!warning(r, /Kaufdaten fehlen/), 'falsche Warnung');
  });

  /* ---------- Erträge ---------- */

  // US: 100 USD × 0,9 = 90,00 €, einbehalten 13,50 € = genau 15 %.
  // CH: 100 CHF × 1,0 = 100,00 €, einbehalten 35,00 €, anrechenbar höchstens 15,00 €.
  test('Dividenden und Quellensteuer mit 15-%-Grenze', function () {
    const ch = { conid: '2', isin: 'CH0000000002', symbol: 'CCC' };
    const r = run([statement({ cash: [
      cash({ currency: 'USD', fxRateToBase: '0.9', amount: '100' }),
      cash({ currency: 'USD', fxRateToBase: '0.9', amount: '-15', type: 'Withholding Tax', description: 'AAA(US0000000001) CASH DIVIDEND - US TAX' }),
      cash(Object.assign({ currency: 'CHF', amount: '100' }, ch)),
      cash(Object.assign({ currency: 'CHF', amount: '-35', type: 'Withholding Tax', description: 'CCC(CH0000000002) CASH DIVIDEND - CH TAX' }, ch))
    ] })], 2025);
    eq(lineCents(r, 'KAP', 19), 19000, 'Zeile 19');
    eq(lineCents(r, 'KAP', 41), 2850, 'Zeile 41');
    const w = warning(r, /Quellensteuer prüfen/, 'pruefen');
    ok(w, 'Prüfpunkt fehlt');
    eq(w.items.length, 1, 'nur die Schweiz ist Prüfpunkt');
  });

  test('Zinsen zählen, Sollzinsen und Gebühren nicht', function () {
    const none = { conid: '', isin: '', symbol: '', assetCategory: '', subCategory: '' };
    const r = run([statement({ cash: [
      cash(Object.assign({ amount: '3.21', type: 'Broker Interest Received' }, none)),
      cash(Object.assign({ amount: '-0.8', type: 'Broker Interest Paid' }, none)),
      cash(Object.assign({ amount: '-4.5', type: 'Other Fees' }, none)),
      cash(Object.assign({ amount: '5000', type: 'Deposits/Withdrawals' }, none))
    ] })], 2025);
    eq(lineCents(r, 'KAP', 19), 321);
    ok(warning(r, /Nicht abziehbar/, 'info'), 'Hinweis fehlt');
    eq(r.complete, true);
  });

  test('Detail- und Summenzeilen derselben Buchung zählen einmal', function () {
    const r = run([statement({ cash: [
      cash({ amount: '100' }),
      cash({ amount: '100', levelOfDetail: 'SUMMARY' })
    ] })], 2025);
    eq(lineCents(r, 'KAP', 19), 10000);
  });

  test('Unbekannte Buchungsart wird gemeldet statt verschluckt', function () {
    const r = run([statement({ cash: [cash({ amount: '12', type: 'Etwas Neues' })] })], 2025);
    eq(lineCents(r, 'KAP', 19), 0);
    ok(warning(r, /Unbekannte Buchungsart/, 'offen'), 'Warnung fehlt');
  });

  /* ---------- Fonds ---------- */

  // 10 Anteile für 1.000 €, Verkauf 4 Anteile für 480 €: Kosten 400 €, Gewinn 80 €. Ausschüttung 12,34 €.
  const fund = { conid: '5', isin: 'IE0000000005', symbol: 'ETF', subCategory: 'ETF' };
  const fundFiles = [
    statement({ year: 2024, trades: [trade(Object.assign({ tradeDate: '20240105', quantity: '10', proceeds: '-1000' }, fund))] }),
    statement({ year: 2025, trades: [trade(Object.assign({ tradeDate: '20250305', quantity: '-4', proceeds: '480' }, fund))],
      cash: [cash(Object.assign({ amount: '12.34' }, fund))] })
  ];

  test('Fonds ohne gewählte Fondsart: berechnet, aber keiner Zeile zugeordnet', function () {
    const r = run(fundFiles, 2025);
    eq(lineCents(r, 'KAP-INV', 4), undefined, 'KAP-INV Zeile 4');
    eq(lineCents(r, 'KAP', 19), 0, 'Fonds gehören nicht in Anlage KAP');
    const pending = r.sections.find(s => s.id === 'offen');
    ok(pending, 'Abschnitt fehlt');
    eq(pending.lines.reduce((s, l) => s + l.cents, 0), 1234 + 8000);
    ok(warning(r, /Fondsart fehlt/, 'offen'), 'Warnung fehlt');
  });

  test('Aktienfonds: Anlage KAP-INV Zeilen 4 und 14', function () {
    const r = run(fundFiles, 2025, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 4), 1234, 'Zeile 4');
    eq(lineCents(r, 'KAP-INV', 14), 8000, 'Zeile 14');
    ok(!warning(r, /Fondsart fehlt/), 'Warnung sollte weg sein');
    ok(warning(r, /Vorabpauschale nicht berechnet/, 'offen'), 'Vorabpauschale muss offen bleiben');
    ok(warning(r, /Abzug früherer Vorabpauschalen unvollständig/, 'pruefen'), 'Prüfpunkt zum fehlenden Abzug fehlt');
  });

  test('Mischfonds: Anlage KAP-INV Zeilen 5 und 17', function () {
    const r = run(fundFiles, 2025, { IE0000000005: 'mischfonds' });
    eq(lineCents(r, 'KAP-INV', 5), 1234);
    eq(lineCents(r, 'KAP-INV', 17), 8000);
  });

  /* ---------- Vorabpauschale ---------- */

  // Je Anteil wie im Vordruck (Zeilen 33 bis 43), Basisertrag 2024 = 1,603 % des Preises zu Jahresbeginn.
  // Preis 100,00 → Basisertrag 1,603 → 1,60. Mehrbetrag = letzter Preis − erster Preis + Ausschüttungen.
  test('Vorabpauschale je Anteil: Basisertrag, Mehrbetrag, Ausschüttungen, Kürzung', function () {
    const calc = (ende, ausschuettung, monate) => K.vorab.jeAnteil({ beginnCents: 10000, endeCents: ende, ausschuettungCents: ausschuettung, prozent: 1.603, monate: monate }).ergebnis;
    eq(calc(11000, 0, 0), 160, 'Basisertrag ist niedriger als der Mehrbetrag von 10,00');
    eq(calc(10050, 0, 0), 50, 'Mehrbetrag 0,50 begrenzt');
    eq(calc(9500, 0, 0), 0, 'Kursverlust: Mehrbetrag negativ');
    eq(calc(11000, 100, 0), 60, '1,60 − 1,00 Ausschüttung');
    eq(calc(11000, 200, 0), 0, 'Ausschüttung über dem Basisertrag');
    // Kauf im März: 2 volle Monate davor. Kürzung 1,60 × 2/12 = 0,2667 → 0,27. Ergebnis 1,33.
    eq(calc(11000, 0, 2), 133, 'Kürzung um 2/12');
    // 2023: 1,785 %. Preis 80,00 → 1,428 → 1,43.
    eq(K.vorab.jeAnteil({ beginnCents: 8000, endeCents: 9000, ausschuettungCents: 0, prozent: 1.785, monate: 0 }).ergebnis, 143, 'Prozentsatz 2023');
  });

  // 10 Anteile, gekauft 2023. Kurs laut IBKR Ende 2023: 100,00, Ende 2024: 110,00.
  // Vorabpauschale 2024 je Anteil 1,60 → 16,00 €. Sie gehört ins Steuerjahr 2025, Zeile 9 (Aktienfonds).
  const heldFund = [
    statement({ year: 2023, trades: [trade(Object.assign({ tradeDate: '20230601', quantity: '10', proceeds: '-1000' }, fund))],
      positions: [position(Object.assign({ position: '10', markPrice: '100', currency: 'EUR' }, fund))] }),
    statement({ year: 2024, positions: [position(Object.assign({ position: '10', markPrice: '110', currency: 'EUR' }, fund))] }),
    statement({ year: 2025 })
  ];

  test('Vorabpauschale aus den Kursen des Exports: Zeile 9 und Prüfpunkt zum Preis', function () {
    const r = run(heldFund, 2025, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 9), 1600, 'Zeile 9');
    ok(warning(r, /Vorabpauschale prüfen/, 'pruefen'), 'Prüfpunkt zum Preis zu Jahresbeginn fehlt');
    ok(!warning(r, /Vorabpauschale nicht berechnet/), 'darf nicht offen sein');
    eq(r.complete, true, 'vollständig');
  });

  // Eingetragener Preis zu Jahresbeginn 99,00 → Basisertrag 1,58697 → 1,59 → 15,90 €.
  test('Vorabpauschale mit eingetragenem Preis: kein Prüfpunkt mehr', function () {
    const r = run(heldFund, 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2024: { beginn: '99,00' } } });
    eq(lineCents(r, 'KAP-INV', 9), 1590, 'Zeile 9');
    ok(!warning(r, /Vorabpauschale prüfen/), 'kein Prüfpunkt');
  });

  test('Vorabpauschale im Vorjahr gehört nicht ins selbe Jahr und nicht doppelt', function () {
    // Steuerjahr 2024 bräuchte die Vorabpauschale 2023: dafür fehlt der Kurs von Ende 2022.
    const r = run(heldFund, 2024, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 9), undefined, 'Zeile 9 im Steuerjahr 2024');
    ok(warning(r, /Vorabpauschale nicht berechnet/, 'offen'), 'offener Punkt fehlt');
  });

  // 20 Anteile, gekauft im März 2024. Ausschüttung 0,50 je Anteil. Preise eingetragen: 100,00 und 110,00.
  // Basisertrag 1,60, Mehrbetrag 10,00 + 0,50 = 10,50, niedriger 1,60, abzüglich 0,50 = 1,10.
  // Kürzung 1,10 × 2/12 = 0,1833 → 0,18. Je Anteil 0,92 → 18,40 €.
  test('Vorabpauschale bei Kauf im Jahr: Kürzung um Zwölftel und Abzug der Ausschüttung', function () {
    const r = run([
      statement({ year: 2024, trades: [trade(Object.assign({ tradeDate: '20240315', quantity: '20', proceeds: '-2000' }, fund))],
        cash: [cash(Object.assign({ settleDate: '20240910', amount: '10', description: 'ETF(IE0000000005) CASH DIVIDEND EUR 0.50 PER SHARE (Ordinary Dividend)' }, fund))] }),
      statement({ year: 2025 })
    ], 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2024: { beginn: '100,00', ende: '110,00' } } });
    eq(lineCents(r, 'KAP-INV', 9), 1840, 'Zeile 9');
    ok(warning(r, /Vorabpauschale prüfen/, 'pruefen'), 'Hinweis auf Ausschüttungen vor dem Kauf fehlt');
  });

  test('Vorabpauschale: bis zum Jahresende verkaufte Anteile zählen nicht', function () {
    const r = run([
      statement({ year: 2023, trades: [trade(Object.assign({ tradeDate: '20230601', quantity: '10', proceeds: '-1000' }, fund))] }),
      statement({ year: 2024, trades: [trade(Object.assign({ tradeDate: '20241115', quantity: '-10', proceeds: '1100' }, fund))] }),
      statement({ year: 2025 })
    ], 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2024: { beginn: '100,00', ende: '110,00' } } });
    eq(lineCents(r, 'KAP-INV', 9), undefined, 'Zeile 9');
    ok(!warning(r, /Vorabpauschale/), 'keine Meldung zur Vorabpauschale');
  });

  // Fonds in USD: Kurs 100 USD × 0,90 = 90,00 € Ende 2023, 120 USD × 0,95 = 114,00 € Ende 2024.
  // Basisertrag 90,00 × 1,603 % = 1,4427 → 1,44. Mehrbetrag 24,00. 10 Anteile → 14,40 €.
  test('Vorabpauschale: Kurse in Fremdwährung werden mit dem Kurs des Stichtags umgerechnet', function () {
    const usd = Object.assign({}, fund, { currency: 'USD' });
    const r = run([
      statement({ year: 2023, trades: [trade(Object.assign({ fxRateToBase: '0.9', tradeDate: '20230601', quantity: '10', proceeds: '-1000' }, usd))],
        positions: [position(Object.assign({ position: '10', markPrice: '100', fxRateToBase: '0.9' }, usd))] }),
      statement({ year: 2024, positions: [position(Object.assign({ position: '10', markPrice: '120', fxRateToBase: '0.95' }, usd))] }),
      statement({ year: 2025 })
    ], 2025, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 9), 1440, 'Zeile 9');
  });

  test('Vorabpauschale: Jahr ohne hinterlegten Prozentsatz bleibt offen', function () {
    const r = run([
      statement({ year: 2026, trades: [trade(Object.assign({ tradeDate: '20260105', quantity: '10', proceeds: '-1000' }, fund))] }),
      statement({ year: 2027 })
    ], 2027, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2026: { beginn: '100,00', ende: '110,00' } } });
    eq(lineCents(r, 'KAP-INV', 9), undefined, 'Zeile 9');
    ok(warning(r, /Vorabpauschale nicht berechnet/, 'offen'), 'offener Punkt fehlt');
  });

  /* ---------- Abzug früherer Vorabpauschalen beim Verkauf ---------- */

  // 10 Anteile, gekauft 01.06.2023 für 1.000 €, verkauft 10.03.2025 für 1.200 €: Gewinn vor Abzug 200,00 €.
  // 2023: Preis zu Jahresbeginn eingetragen 90,00 → Basisertrag 1,6065 → 1,61. Mehrbetrag 100,00 − 90,00 = 10,00.
  //   Kauf im Juni: 5 volle Monate davor, Kürzung 1,61 × 5/12 = 0,6708 → 0,67. Je Anteil 0,94 → 9,40 €.
  // 2024: Kurse laut Export 100,00 und 110,00 → je Anteil 1,60 → 16,00 €.
  // Zeile 53: 9,40 + 16,00 = 25,40 €. Zeile 14: 200,00 − 25,40 = 174,60 €. Zeile 9 (Vorabpauschale 2024): 16,00 €.
  const soldFund = heldFund.slice(0, 2).concat([
    statement({ year: 2025, trades: [trade(Object.assign({ tradeDate: '20250310', quantity: '-10', proceeds: '1200' }, fund))] })
  ]);

  test('Fondsverkauf: Vorabpauschalen der Haltezeit mindern den Gewinn', function () {
    const r = run(soldFund, 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2023: { beginn: '90,00' } } });
    eq(lineCents(r, 'KAP-INV', 14), 17460, 'Zeile 14');
    eq(lineCents(r, 'KAP-INV', 9), 1600, 'Zeile 9');
    ok(warning(r, /Abzug früherer Vorabpauschalen prüfen/, 'pruefen'), 'Prüfpunkt zum Abzug fehlt');
    ok(!warning(r, /Abzug früherer Vorabpauschalen unvollständig/), 'Abzug ist vollständig');
    eq(r.vorab.funds.map(f => f.year + ':' + f.abzug).join(' '), '2023:940 2024:1600', 'Preistabelle je Jahr');
  });

  // Ohne den Preis zu Jahresbeginn 2023 lässt sich nur 2024 abziehen: 200,00 − 16,00 = 184,00 €.
  test('Fondsverkauf: fehlt ein Preis, wird das Jahr nicht abgezogen und gemeldet', function () {
    const r = run(soldFund, 2025, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 14), 18400, 'Zeile 14');
    const open = warning(r, /Abzug früherer Vorabpauschalen unvollständig/, 'pruefen');
    ok(open && /2023 \(Preise fehlen\)/.test(open.items[0].text), 'Hinweis auf 2023 fehlt');
  });

  // 2021 und 2022 war der Basiszins negativ: keine Vorabpauschale, also auch kein Abzug. Gewinn 1.100 − 1.000 = 100,00 €.
  test('Fondsverkauf: Jahre mit negativem Basiszins brauchen keine Preise', function () {
    const r = run([
      statement({ year: 2021, trades: [trade(Object.assign({ tradeDate: '20210310', quantity: '10', proceeds: '-1000' }, fund))] }),
      statement({ year: 2022 }),
      statement({ year: 2023, trades: [trade(Object.assign({ tradeDate: '20230510', quantity: '-10', proceeds: '1100' }, fund))] })
    ], 2023, { IE0000000005: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 14), 10000, 'Zeile 14');
    ok(!warning(r, /Vorabpauschale/), 'keine Meldung zur Vorabpauschale');
    eq(r.vorab.funds.length, 0, 'keine Preise verlangt');
  });

  // Zwei Käufe: 10 Anteile am 15.01.2023 für 1.000 €, 10 Anteile am 20.08.2024 für 1.050 €. Verkauf 15 Anteile am 10.02.2025 für 1.800 €.
  // FIFO: 10 Anteile aus 2023 (Kosten 1.000 €) und 5 aus 2024 (Kosten 525 €). Gewinn vor Abzug 1.800 − 1.525 = 275,00 €.
  // 2023 (Preise 98,00 und 104,00): Basisertrag 98,00 × 1,785 % = 1,7493 → 1,75. 10 Anteile → 17,50 €.
  // 2024 (Preise 104,00 und 110,00): Basisertrag 1,66712 → 1,67. Anteile aus 2023: 10 × 1,67 = 16,70 €.
  //   Anteile aus August 2024: 7 volle Monate davor, Kürzung 1,67 × 7/12 = 0,9742 → 0,97, je Anteil 0,70. 5 verkaufte Anteile → 3,50 €.
  // Zeile 53: 17,50 + 16,70 + 3,50 = 37,70 €. Zeile 14: 275,00 − 37,70 = 237,30 €.
  // Zeile 9 (Vorabpauschale 2024 für alle 20 Anteile): 16,70 + 10 × 0,70 = 23,70 €.
  test('Fondsverkauf mit zwei Käufen: Abzug je verkauftem Anteil nach FIFO', function () {
    const r = run([
      statement({ year: 2023, trades: [trade(Object.assign({ tradeDate: '20230115', quantity: '10', proceeds: '-1000' }, fund))] }),
      statement({ year: 2024, trades: [trade(Object.assign({ tradeDate: '20240820', quantity: '10', proceeds: '-1050' }, fund))] }),
      statement({ year: 2025, trades: [trade(Object.assign({ tradeDate: '20250210', quantity: '-15', proceeds: '1800' }, fund))] })
    ], 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2023: { beginn: '98,00', ende: '104,00' }, 2024: { beginn: '104,00', ende: '110,00' } } });
    eq(lineCents(r, 'KAP-INV', 14), 23730, 'Zeile 14');
    eq(lineCents(r, 'KAP-INV', 9), 2370, 'Zeile 9');
  });

  // 10 Anteile für 1.000 €, Split 2:1 im Juni 2024, Verkauf 20 Anteile für 1.300 €: Gewinn 300,00 €.
  // Die Preise je Anteil vor dem Split passen nicht zur Stückzahl danach, deshalb wird nichts abgezogen.
  test('Fondsverkauf nach Split: kein Abzug, aber Meldung', function () {
    const r = run([
      statement({ year: 2023, trades: [trade(Object.assign({ tradeDate: '20230601', quantity: '10', proceeds: '-1000' }, fund))] }),
      statement({ year: 2024, actions: [action(Object.assign({ quantity: '10' }, fund))] }),
      statement({ year: 2025, trades: [trade(Object.assign({ tradeDate: '20250310', quantity: '-20', proceeds: '1300' }, fund))] })
    ], 2025, { IE0000000005: 'aktienfonds' }, { IE0000000005: { 2023: { beginn: '90,00', ende: '100,00' } } });
    eq(lineCents(r, 'KAP-INV', 14), 30000, 'Zeile 14');
    const open = warning(r, /Abzug früherer Vorabpauschalen unvollständig/, 'pruefen');
    ok(open && /Kapitalmaßnahme/.test(open.items[0].text), 'Hinweis auf die Kapitalmaßnahme fehlt');
    ok(!warning(r, /Abzug früherer Vorabpauschalen prüfen/), 'nichts abgezogen');
  });

  /* ---------- Einordnung und Sonderfälle ---------- */

  test('Wertpapier ohne Angabe der Art: erst nach Auswahl gerechnet', function () {
    const files = [statement({ trades: [
      trade({ subCategory: '', tradeDate: '20250110', quantity: '10', proceeds: '-1000' }),
      trade({ subCategory: '', tradeDate: '20250610', quantity: '-10', proceeds: '1100' })
    ] })];
    const before = run(files, 2025);
    eq(lineCents(before, 'KAP', 20), 0);
    ok(warning(before, /Art des Wertpapiers fehlt/, 'offen'), 'Warnung fehlt');
    eq(lineCents(run(files, 2025, { US0000000001: 'aktie' }), 'KAP', 20), 10000);
  });

  // Kauf 300 + 1,25 = 301,25 €.  Verkauf 350 − 1,25 = 348,75 €.  Gewinn 47,50 €.
  test('Deutsche Aktie: Verkauf in Zeile 18, Dividende ausgeklammert', function () {
    const de = { conid: '4', isin: 'DE0000000004', symbol: 'DDD' };
    const r = run([statement({
      trades: [
        trade(Object.assign({ tradeDate: '20250804', quantity: '5', proceeds: '-300', ibCommission: '-1.25' }, de)),
        trade(Object.assign({ tradeDate: '20251103', quantity: '-5', proceeds: '350', ibCommission: '-1.25' }, de))
      ],
      cash: [
        cash(Object.assign({ amount: '5' }, de)),
        cash(Object.assign({ amount: '-1.32', type: 'Withholding Tax', description: 'DDD(DE0000000004) CASH DIVIDEND - DE TAX' }, de))
      ]
    })], 2025);
    eq(lineCents(r, 'KAP', 18), 4750, 'Zeile 18');
    eq(lineCents(r, 'KAP', 19), 0, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 4750, 'Zeile 20');
    eq(lineCents(r, 'KAP', 41), 0, 'Zeile 41');
    ok(warning(r, /Dividenden deutscher Aktien/, 'offen'), 'Warnung fehlt');
  });

  test('Optionen: offener Punkt. Währungstausch: nur Prüfpunkt', function () {
    const opt = run([statement({ trades: [trade({ assetCategory: 'OPT', subCategory: 'C', conid: '9', isin: '', tradeDate: '20250610', quantity: '-1', proceeds: '150', openCloseIndicator: 'O' })] })], 2025);
    ok(warning(opt, /Optionen werden noch nicht berechnet/, 'offen'), 'Warnung fehlt');
    eq(opt.complete, false);
    const fx = run([statement({ trades: [trade({ assetCategory: 'CASH', subCategory: '', conid: '8', isin: '', symbol: 'EUR.USD', currency: 'USD', fxRateToBase: '0.9', tradeDate: '20250317', quantity: '2700', proceeds: '-3000' })] })], 2025);
    ok(warning(fx, /Währungstausch/, 'pruefen'), 'Prüfpunkt fehlt');
    eq(fx.complete, true);
  });

  test('Basiswährung nicht EUR: Datei wird abgelehnt', function () {
    throws(() => run([statement({ base: 'USD' })], 2025), /Basiswährung/);
    const hidden = statement({ base: null, trades: [trade({ currency: 'EUR', fxRateToBase: '1.08', quantity: '1', proceeds: '-10' })] });
    throws(() => run([hidden], 2025), /Basiswährung/);
  });

  test('Fehlendes Pflichtfeld: Abbruch mit Feldname', function () {
    throws(() => run([statement({ trades: [trade({ fxRateToBase: null, quantity: '1', proceeds: '-10' })] })], 2025), /fxRateToBase/);
    throws(() => run([statement({ trades: [trade({ conid: null, quantity: '1', proceeds: '-10' })] })], 2025), /conid/);
  });

  test('Lücke im Steuerjahr: offener Punkt', function () {
    const r = run([statement({ from: '20250101', to: '20250630' })], 2025);
    const w = warning(r, /fehlen Daten/, 'offen');
    ok(w, 'Warnung fehlt');
    ok(/01\.07\.2025 bis 31\.12\.2025/.test(w.items[0].text), 'Zeitraum der Lücke: ' + w.items[0].text);
  });

  test('Bestandsabgleich mit dem Bestand laut IBKR', function () {
    const buy = [trade({ tradeDate: '20250110', quantity: '10', proceeds: '-1000' })];
    const good = run([statement({ trades: buy, positions: [position({ position: '10' })] })], 2025);
    ok(warning(good, /Bestandsabgleich stimmt/, 'info'), 'Hinweis fehlt');
    const bad = run([statement({ trades: buy, positions: [position({ position: '12' })] })], 2025);
    ok(warning(bad, /Bestand weicht/, 'pruefen'), 'Abweichung nicht gemeldet');
  });

  test('Steuerjahr ohne hinterlegte Zeilennummern: Prüfpunkt', function () {
    const r = run([statement({ year: 2027 })], 2027);
    ok(warning(r, /Zeilennummern/, 'pruefen'), 'Prüfpunkt fehlt');
    ok(!warning(run([statement({})], 2025), /Zeilennummern/), 'für 2025 kein Prüfpunkt');
  });

  // Abgeglichen mit den amtlichen Vordrucken 2025 im Formular-Management-System der Bundesfinanzverwaltung, Stand 25.11.2026.
  test('Zeilennummern 2025 entsprechen dem amtlichen Vordruck', function () {
    const f = K.forms.forYear(2025);
    const funds = ['aktienfonds', 'mischfonds', 'immobilienfonds', 'auslandsimmobilienfonds', 'sonstigerfonds'];
    eq(f.exact, true, 'eigene Nummern für 2025');
    eq([f.kap.inland, f.kap.ausland, f.kap.aktiengewinne, f.kap.sonstigeVerluste, f.kap.aktienverluste, f.kap.auslaendischeSteuern].join(','), '18,19,20,22,23,41', 'Anlage KAP');
    eq(funds.map(t => f.kapinv.ausschuettung[t]).join(','), '4,5,6,7,8', 'KAP-INV Ausschüttungen');
    eq(f.kapinv.vorabpauschale.von + '-' + f.kapinv.vorabpauschale.bis, '9-13', 'KAP-INV Vorabpauschalen');
    eq(funds.map(t => f.kapinv.vorabpauschaleJeArt[t]).join(','), '9,10,11,12,13', 'KAP-INV Vorabpauschalen je Fondsart');
    const v = f.kapinv.vorabRechnung;
    eq([v.preisBeginn, v.basisertrag, v.letzterPreis, v.ausschuettungen, v.mehrbetrag, v.niedrigerer, v.zwischen, v.kuerzung, v.jeAnteil, v.anteile, v.ergebnis].join(','), '33,34,35,37,38,39,41,42,43,44,45', 'Rechenweg Seite 2');
    eq(K.forms.basisertragProzent(2024), 1.603, 'Basisertrag 2024 laut Vordruck 2025');
    eq(K.forms.basisertragProzent(2023), 1.785, 'Basisertrag 2023 laut Vordruck 2024');
    eq(K.forms.basisertragProzent(2026), null, 'kein Prozentsatz für 2026');
    // 2019 und 2020 laut Vordruck 2020 und 2021; 2021 und 2022 ohne Vorabpauschale; 2018 aus dem Basiszins 0,87 % (nicht im Vordruck).
    eq([2018, 2019, 2020, 2021, 2022].map(y => K.forms.basisertragProzent(y)).join(' '), '0.609 0.364 0.049 0 0', 'Basisertrag 2018 bis 2022');
    eq(f.kapinv.verkaufRechnung.vorabpauschalen + ',' + f.kapinv.verkaufRechnung.ergebnis, '53,54', 'Rechenweg Seite 3');
    eq(funds.map(t => f.kapinv.veraeusserung[t]).join(','), '14,17,20,23,26', 'KAP-INV Verkäufe');
  });

  /* ---------- Beispieldaten von Anfang bis Ende ---------- */

  // ACME: Käufe 2.001 USD × 0,92 = 1.840,92 € (20 Stk.) und 1.201 USD × 0,93 = 1.116,93 € (10 Stk.); Split 2:1 → 40 + 20 Stk.
  //   Verkauf 50 Stk.: 3.498,50 USD × 0,92 = 3.218,62 €.  40 Stk.: 2.574,90 − 1.840,92 = 733,98.
  //   10 Stk.: 643,72 − 558,47 = 85,25.  Gewinn 819,23 €.
  // BETA: Kauf 751 USD × 0,93 = 698,43 €; Verkauf 599 USD × 0,89 = 533,11 €; Verlust 165,32 €.
  // MUSTER (deutsch): 348,75 − 301,25 = 47,50 € → Zeile 18.
  // Dividenden: ACME 7,50 USD × 0,95 = 7,13 und 1,50 USD × 0,90 = 1,35; ALPEN 40 CHF × 1,05 = 42,00.  Summe 50,48 €.
  // Zinsen: 3,21 + 2,00 USD × 0,85 = 1,70.  Summe 4,91 €.
  // Zeile 19: 819,23 − 165,32 + 50,48 + 4,91 = 709,30 €.  Zeile 20: 819,23 + 47,50 = 866,73 €.
  // Quellensteuer: ACME einbehalten 1,07 + 0,21 = 1,28, Grenze 15 % von 8,48 = 1,27. ALPEN einbehalten 14,70, Grenze 6,30.  Zeile 41: 7,57 €.
  // WELT (Fonds): Kauf 2.401,25 € für 30 Stk.; Verkauf 10 Stk. 948,75 − 800,42 = 148,33 €; Ausschüttung 15,00 €.
  function sample(year, types, prices) {
    return run(K.samples.map(s => s.xml), year, types, prices);
  }

  test('Beispieldaten 2025: Anlage KAP', function () {
    const r = sample(2025);
    eq(lineCents(r, 'KAP', 18), 4750, 'Zeile 18');
    eq(lineCents(r, 'KAP', 19), 70930, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 86673, 'Zeile 20');
    eq(lineCents(r, 'KAP', 23), 16532, 'Zeile 23');
    eq(lineCents(r, 'KAP', 41), 757, 'Zeile 41');
  });

  test('Beispieldaten 2025: Anlage KAP-INV nach Wahl der Fondsart', function () {
    const r = sample(2025, { IE0000002001: 'aktienfonds' });
    eq(lineCents(r, 'KAP-INV', 4), 1500, 'Zeile 4');
    eq(lineCents(r, 'KAP-INV', 14), 14833, 'Zeile 14');
  });

  test('Beispieldaten 2025: offene Punkte und Abgleich', function () {
    const r = sample(2025);
    ['Fondsart fehlt', 'Optionen werden noch nicht berechnet', 'Vorabpauschale nicht berechnet', 'Dividenden deutscher Aktien'].forEach(function (title) {
      ok(warning(r, new RegExp(title), 'offen'), 'offener Punkt fehlt: ' + title);
    });
    ok(warning(r, /Quellensteuer prüfen/, 'pruefen'), 'Prüfpunkt Quellensteuer fehlt');
    ok(warning(r, /Währungstausch/, 'pruefen'), 'Prüfpunkt Währungstausch fehlt');
    ok(warning(r, /Bestandsabgleich stimmt/, 'info'), 'Bestandsabgleich fehlt');
    ok(!warning(r, /Bestand weicht/), 'Bestand darf nicht abweichen');
    ok(!warning(r, /Kaufdaten fehlen/), 'Kaufdaten sind vollständig');
    eq(r.complete, false);
  });

  // WELT: 30 Anteile, gekauft im April 2024 (3 volle Monate davor). Preis zu Jahresbeginn eingetragen 78,00, Kurs Ende 2024 laut Export 88,00.
  // Basisertrag 78,00 × 1,603 % = 1,25034 → 1,25. Mehrbetrag 10,00. Kürzung 1,25 × 3/12 = 0,3125 → 0,31. Je Anteil 0,94 → 28,20 €.
  test('Beispieldaten 2025: Vorabpauschale nach Eingabe des Preises zu Jahresbeginn', function () {
    const r = sample(2025, { IE0000002001: 'aktienfonds' }, { IE0000002001: { 2024: { beginn: '78,00' } } });
    eq(lineCents(r, 'KAP-INV', 9), 2820, 'Zeile 9');
    // Verkauf von 10 Anteilen im Jahr 2025: 148,33 − 10 × 0,94 = 138,93 €.
    eq(lineCents(r, 'KAP-INV', 14), 13893, 'Zeile 14 nach Abzug der Vorabpauschale 2024');
    ok(!warning(r, /Vorabpauschale nicht berechnet/), 'nicht mehr offen');
    const row = r.vorab.funds[0];
    eq(row.exportEnde, 8800, 'Kurs Ende 2024 aus dem Export');
    eq(row.exportBeginn, null, 'kein Kurs zu Jahresbeginn im Export');
  });

  // 2024: Dividende 7,50 USD × 0,91 = 6,83 €; einbehalten 1,03 €, Grenze 15 % von 6,83 = 1,02 €.
  test('Beispieldaten 2024', function () {
    const r = sample(2024);
    eq(lineCents(r, 'KAP', 19), 683, 'Zeile 19');
    eq(lineCents(r, 'KAP', 20), 0, 'Zeile 20');
    eq(lineCents(r, 'KAP', 41), 102, 'Zeile 41');
  });

  test('CSV-Export enthält Summen und Einzelposten', function () {
    const csv = K.report.toCsv(sample(2025));
    ok(csv.charCodeAt(0) === 0xFEFF, 'BOM fehlt');
    ok(csv.indexOf('"KAP";"19"') > 0, 'Zeile 19 fehlt');
    ok(csv.indexOf('"709,30"') > 0, 'Summe Zeile 19 fehlt');
    ok(csv.indexOf('"-165,32"') > 0, 'Einzelposten fehlt');
  });

  /* ---------- Ausgabe ---------- */

  const failed = results.filter(r => !r.ok);
  window.__tests = { total: results.length, passed: results.length - failed.length, failed: failed };

  const summary = document.getElementById('summary');
  const list = document.getElementById('list');
  if (summary && list) {
    summary.textContent = failed.length
      ? failed.length + ' von ' + results.length + ' Tests fehlgeschlagen'
      : 'Alle ' + results.length + ' Tests bestanden';
    summary.className = failed.length ? 'bad' : 'good';
    results.forEach(function (r) {
      const li = document.createElement('li');
      li.className = r.ok ? 'good' : 'bad';
      li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ' — ' + r.error);
      list.appendChild(li);
    });
  }
})();
