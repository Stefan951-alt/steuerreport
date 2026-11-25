/* Vorabpauschale nach § 18 InvStG, gerechnet wie auf Seite 2 der Anlage KAP-INV (Zeilen 33 bis 45):
   erst je Anteil in Euro und Cent, am Ende mal Stückzahl. Alle Beträge hier in Cent. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};

  // Kaufmännisch auf ganze Cent. Nur für Werte ab null gedacht.
  const round = x => Math.floor(x + 0.5 + 1e-9);

  // Werte je Anteil. prozent = Basisertrag in Prozent des Preises zu Jahresbeginn (70 % des Basiszinses).
  // monate = volle Monate vor dem Monat des Kaufs im Jahr der Vorabpauschale, 0 bei früherem Kauf.
  function jeAnteil(input) {
    const basisertrag = round(input.beginnCents * input.prozent / 100);
    const mehrbetrag = input.endeCents - input.beginnCents + input.ausschuettungCents;
    const niedrigerer = Math.min(basisertrag, mehrbetrag);
    const out = { basisertrag: basisertrag, mehrbetrag: mehrbetrag, niedrigerer: niedrigerer, zwischen: 0, kuerzung: 0, ergebnis: 0 };
    // Vordruck: Ist einer der beiden Zwischenwerte negativ, steht in der Ergebniszeile eine Null.
    if (niedrigerer < 0) return out;
    out.zwischen = niedrigerer - input.ausschuettungCents;
    if (out.zwischen < 0) return out;
    out.kuerzung = round(out.zwischen * input.monate / 12);
    out.ergebnis = out.zwischen - out.kuerzung;
    return out;
  }

  // Spalten des Vordrucks: Anteile, die am Jahresende noch da sind. Käufe im Jahr der Vorabpauschale
  // stehen je Kaufmonat in einer eigenen Spalte, weil sich für sie die Kürzung unterscheidet.
  function spalten(lots, calendarYear) {
    const columns = new Map();
    lots.forEach(function (lot) {
      const inYear = lot.date.slice(0, 4) === String(calendarYear);
      const erwerb = inYear ? lot.date.slice(0, 7) : '';
      const column = columns.get(erwerb) || { erwerb: erwerb, monate: inYear ? Number(lot.date.slice(5, 7)) - 1 : 0, q: 0 };
      column.q += lot.q;
      columns.set(erwerb, column);
    });
    return Array.from(columns.values()).sort((a, b) => (a.erwerb < b.erwerb ? -1 : a.erwerb > b.erwerb ? 1 : 0));
  }

  // Ausschüttung je Anteil aus dem Buchungstext von IBKR („… CASH DIVIDEND USD 0.25 PER SHARE …“), sonst null.
  function ausschuettungJeAnteil(description, currency) {
    const m = /\b([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)\s+PER\s+SHARE\b/i.exec(description || '');
    if (!m || m[1].toUpperCase() !== currency) return null;
    return Number(m[2]);
  }

  K.vorab = { jeAnteil: jeAnteil, spalten: spalten, ausschuettungJeAnteil: ausschuettungJeAnteil };
})(typeof window !== 'undefined' ? window : globalThis);
