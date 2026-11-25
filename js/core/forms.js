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
        veraeusserung: { aktienfonds: 14, mischfonds: 17, immobilienfonds: 20, auslandsimmobilienfonds: 23, sonstigerfonds: 26 },
        // Rechenweg des Verkaufs je Fonds auf Seite 3 des Vordrucks: Abzug der Vorabpauschalen aus der Besitzzeit, Ergebnis.
        verkaufRechnung: { vorabpauschalen: 53, ergebnis: 54 }
      }
    }
  };
  const REFERENCE_YEAR = 2025;

  // Basisertrag in Prozent des Preises zu Jahresbeginn (70 % des Basiszinses), je Kalenderjahr der Vorabpauschale.
  // Quelle: Zeile 34 der Anlage KAP-INV des Folgejahres (Vordrucke 2020, 2021, 2024 und 2025, abgeglichen am 25.11.2026).
  // 0 heißt: Basiszins negativ, keine Vorabpauschale (Vordrucke 2022 und 2023: Zeilen 9 bis 13 frei).
  // 2018 steht in keinem Vordruck, der Vordruck 2019 hat keinen Rechenteil. Der Wert folgt aus dem Basiszins von 0,87 %
  // laut BMF-Schreiben vom 4.1.2018 (BStBl I S. 249) und ist nicht am Vordruck abgeglichen.
  const BASISERTRAG_PROZENT = { 2018: 0.609, 2019: 0.364, 2020: 0.049, 2021: 0, 2022: 0, 2023: 1.785, 2024: 1.603 };

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
