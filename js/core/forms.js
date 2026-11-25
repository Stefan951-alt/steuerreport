/* Zeilennummern der Vordrucke je Steuerjahr. Die Nummern ändern sich von Jahr zu Jahr,
   deshalb stehen sie hier an einer Stelle und nicht im Rechenkern. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};

  const BY_YEAR = {
    // Stand 25.11.2026: mit den amtlichen Vordrucken im Formular-Management-System der Bundesfinanzverwaltung abgeglichen
    // (Anlage KAP 2025, Fassung Oktober 2025; Anlage KAP-INV 2025, Fassung September 2025).
    2025: {
      kap: { inland: 18, ausland: 19, aktiengewinne: 20, sonstigeVerluste: 22, aktienverluste: 23, auslaendischeSteuern: 41 },
      kapinv: {
        ausschuettung: { aktienfonds: 4, mischfonds: 5, immobilienfonds: 6, auslandsimmobilienfonds: 7, sonstigerfonds: 8 },
        vorabpauschale: { von: 9, bis: 13 },
        vorabpauschaleJeArt: { aktienfonds: 9, mischfonds: 10, immobilienfonds: 11, auslandsimmobilienfonds: 12, sonstigerfonds: 13 },
        // Rechenweg der Vorabpauschale je Fonds auf Seite 2 des Vordrucks.
        vorabRechnung: { preisBeginn: 33, basisertrag: 34, letzterPreis: 35, ausschuettungen: 37, mehrbetrag: 38, niedrigerer: 39, zwischen: 41, kuerzung: 42, jeAnteil: 43, anteile: 44, ergebnis: 45 },
        veraeusserung: { aktienfonds: 14, mischfonds: 17, immobilienfonds: 20, auslandsimmobilienfonds: 23, sonstigerfonds: 26 }
      }
    }
  };
  const REFERENCE_YEAR = 2025;

  // Basisertrag in Prozent des Preises zu Jahresbeginn (70 % des Basiszinses), je Kalenderjahr der Vorabpauschale.
  // Quelle: Zeile 34 der Anlage KAP-INV des Folgejahres (Vordruck 2024: 1,785 % für 2023, Vordruck 2025: 1,603 % für 2024).
  const BASISERTRAG_PROZENT = { 2023: 1.785, 2024: 1.603 };

  // exact = false: für dieses Jahr sind keine eigenen Nummern hinterlegt, es gelten ersatzweise die des Referenzjahres.
  function forYear(year) {
    const exact = Object.prototype.hasOwnProperty.call(BY_YEAR, year);
    const base = BY_YEAR[exact ? year : REFERENCE_YEAR];
    return { year: Number(year), exact: exact, basedOn: exact ? Number(year) : REFERENCE_YEAR, kap: base.kap, kapinv: base.kapinv };
  }

  // null: für dieses Kalenderjahr ist kein Prozentsatz hinterlegt.
  function basisertragProzent(calendarYear) {
    return Object.prototype.hasOwnProperty.call(BASISERTRAG_PROZENT, calendarYear) ? BASISERTRAG_PROZENT[calendarYear] : null;
  }

  K.forms = { forYear: forYear, basisertragProzent: basisertragProzent };
})(typeof window !== 'undefined' ? window : globalThis);
