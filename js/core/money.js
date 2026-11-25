/* Beträge in ganzen Cent, Mengen in Millionstel-Stücken: so summieren sich keine Gleitkomma-Reste auf. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};
  const QTY_SCALE = 1000000;

  // null = Feld fehlt, NaN = Feld ist keine Zahl. Der Aufrufer entscheidet, was davon ein Fehler ist.
  function parseDec(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }

  // Eingabe eines Euro-Betrags durch den Nutzer, etwa „88,50“, „1.234,56“ oder „88.5“. Ergebnis in Cent.
  // null = leer, NaN = nicht eindeutig lesbar („1.234“ könnte 1234 oder 1,234 heißen).
  function parseEuro(text) {
    const s = String(text === null || text === undefined ? '' : text).replace(/[\s€]/g, '');
    if (s === '') return null;
    let normalized;
    if (/^(\d+|\d{1,3}(\.\d{3})+),\d+$/.test(s)) normalized = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d+(\.\d{1,2})?$/.test(s)) normalized = s;
    else return NaN;
    return toCents(Number(normalized));
  }

  // Kaufmännisch runden. Der kleine Zuschlag fängt Darstellungsfehler wie 1.005 * 100 = 100.4999… ab.
  function toCents(amount) {
    const sign = amount < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(amount) * 100 + 1e-7) || 0;
  }

  function toQty(quantity) {
    return Math.round(quantity * QTY_SCALE) || 0;
  }

  function group(digits, separator) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }

  // ascii = für CSV: Minus als Bindestrich, keine Tausenderpunkte.
  function fmtCents(cents, ascii) {
    const abs = Math.abs(cents);
    const euros = Math.floor(abs / 100);
    const ct = abs % 100;
    const sign = cents < 0 ? (ascii ? '-' : '−') : '';
    return sign + group(String(euros), ascii ? '' : '.') + ',' + (ct < 10 ? '0' : '') + ct;
  }

  function fmtNumber(n, maxDecimals, fixed) {
    const decimals = maxDecimals === undefined ? 2 : maxDecimals;
    let s = Math.abs(n).toFixed(decimals);
    if (!fixed && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    const parts = s.split('.');
    parts[0] = group(parts[0], '.');
    return (n < 0 ? '−' : '') + parts.join(',');
  }

  function fmtQty(q) {
    return fmtNumber(q / QTY_SCALE, 6);
  }

  function fmtDate(iso) {
    return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';
  }

  K.money = {
    QTY_SCALE: QTY_SCALE,
    parseDec: parseDec,
    parseEuro: parseEuro,
    toCents: toCents,
    toQty: toQty,
    fmtCents: fmtCents,
    fmtNumber: fmtNumber,
    fmtQty: fmtQty,
    fmtDate: fmtDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
