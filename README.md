# Steuerreport für Auslandsdepots

Rechnet aus dem Flex-Query-Export von Interactive Brokers die Werte für **Anlage KAP** und **Anlage KAP-INV** der deutschen Einkommensteuererklärung. Zu jeder Zahl zeigt der Bericht die Buchungen, aus denen sie entsteht.

**Im Browser benutzen:** https://stefan951-alt.github.io/steuerreport/

Die Seite läuft vollständig im Browser. Die Exportdatei wird nicht hochgeladen, es gibt keinen Server und keine externen Skripte.

> **Rechenhilfe, keine Steuerberatung.** Die Rechenlogik ist bisher nur gegen erfundene Beispieldaten geprüft, nicht gegen einen echten Export und nicht von einem Steuerberater. Vor dem ersten Einsatz mit echten Zahlen beides nachholen.
>
> Die Feld- und Abschnittsnamen des Exports sind mit der Formatbeschreibung des Open-Source-Projekts [ibflex](https://github.com/csingley/ibflex) abgeglichen.

## Benutzen

Die Seite oben öffnen (oder `index.html` aus diesem Projekt), XML-Dateien hineinziehen, Steuerjahr wählen. „Beispieldaten laden“ zeigt den Ablauf mit einem erfundenen Depot.

Getestet ist die Seite über einen lokalen Webserver. Das Öffnen per Doppelklick sollte ebenso funktionieren (keine Module, keine Netzwerkzugriffe), ist aber noch nicht geprüft.

Geladen werden sollte eine Datei je Kalenderjahr, zurück bis zum ersten Kauf: Ohne die Käufe lassen sich die Anschaffungskosten eines Verkaufs nicht bestimmen.

### Export bei Interactive Brokers erstellen

1. Im Client Portal eine neue **Activity Flex Query** anlegen.
2. Abschnitte auswählen, jeweils mit allen Feldern: Account Information, Trades (Option „Execution“), Cash Transactions, Corporate Actions, Open Positions, Financial Instrument Information.
3. Format XML, Datumsformat `yyyyMMdd`, Zeitformat `HHmmss`.
4. Je Kalenderjahr einmal ausführen (ein Lauf deckt höchstens 365 Tage ab).

Voraussetzung ist ein Konto mit Basiswährung EUR.

## Was gerechnet wird

| Vorgang | Ergebnis |
| --- | --- |
| Verkäufe von Aktien | Gewinn oder Verlust nach FIFO je Depot und Wertpapier → Anlage KAP Zeilen 19, 20, 23 (deutsche Aktien: Zeile 18) |
| Dividenden ausländischer Aktien, Zinsen | Anlage KAP Zeile 19 |
| Ausländische Quellensteuer auf Dividenden | Anlage KAP Zeile 41, höchstens 15 % der Bruttodividende |
| Verkäufe und Ausschüttungen von Fonds und ETFs | Anlage KAP-INV, Zeile je nach Fondsart |
| Vorabpauschale für Fonds und ETFs | Anlage KAP-INV Zeilen 9 bis 13, gerechnet wie auf Seite 2 des Vordrucks (Zeilen 33 bis 45) |
| Aktiensplits | Anschaffungskosten werden auf die neue Stückzahl verteilt |

Die Zeilennummern sind für das Steuerjahr 2025 hinterlegt (`js/core/forms.js`). Für andere Jahre zeigt der Bericht die Nummern von 2025 und weist darauf hin. Die Nummern für 2025 sind mit den amtlichen Vordrucken abgeglichen (Stand November 2026).

### Rechenregeln

- **Umrechnung:** Anschaffungskosten zum Kurs des Kauftags, Erlös zum Kurs des Verkaufstags, jeweils mit dem Kurs aus dem Export (`fxRateToBase`). Gebühren und Transaktionssteuern sind eingerechnet.
- **Zeitpunkt:** Bei Verkäufen zählt der Handelstag, bei Dividenden und Zinsen der Tag der Gutschrift.
- **Gewinn und Verlust:** Je Verkauf ein Ergebnis. Ab null zählt es als Gewinn (Zeile 20), darunter als Verlust (Zeile 23).
- **Rundung:** Jeder Vorgang wird in Euro auf ganze Cent gerundet, gerechnet wird danach nur mit ganzen Cent.
- **Fonds:** Beträge stehen in voller Höhe im Bericht. Die Teilfreistellung zieht das Finanzamt ab.
- **Vorabpauschale:** Sie gilt am ersten Werktag des Folgejahres als zugeflossen. Im Bericht für 2025 steht deshalb die Vorabpauschale für 2024. Gerechnet wird je Anteil in Euro und Cent, wie im Vordruck. Der Prozentsatz für den Basisertrag ist für 2023 (1,785 %) und 2024 (1,603 %) hinterlegt.
- **Fondspreise:** Der Vordruck verlangt je Fonds den Preis eines Anteils zu Beginn und am Ende des Jahres. Der Export enthält nur Kurse zum Jahresende. Den Preis zu Jahresbeginn trägst du im Bericht ein. Fehlt die Eingabe, nimmt der Bericht den Schlusskurs des Vorjahres und weist das als Prüfpunkt aus.

## Was nicht gerechnet wird

Der Grundsatz: Was nicht sicher berechnet werden kann, steht als **offener Punkt** im Bericht und in keiner Summe. Solange offene Punkte bestehen, meldet der Bericht „Noch nicht vollständig“.

- Optionen, Futures, CFDs, Anleihen, Zertifikate, Kryptowerte
- Abzug früherer Vorabpauschalen beim Verkauf von Fonds
- Vorabpauschale für Jahre ohne hinterlegten Prozentsatz und für Fonds mit einer Kapitalmaßnahme im Jahr
- Leerverkäufe
- Kapitalmaßnahmen außer Aktiensplits (Abspaltungen, Fusionen, Aktiendividenden, Bezugsrechte)
- Dividenden deutscher Aktien (dort wird deutsche Kapitalertragsteuer einbehalten)
- Gewinne und Verluste aus Fremdwährungsguthaben
- Fondsanteile, die vor 2018 gekauft wurden
- Konten mit anderer Basiswährung als EUR

### Annahmen, die du prüfen solltest

- Die Obergrenze von 15 % für anrechenbare Quellensteuer ist der Regelfall der Doppelbesteuerungsabkommen. Für andere Länder als die USA weist der Bericht einen Prüfpunkt aus.
- Die Fondsart (Aktienfonds, Mischfonds …) geht aus dem Export nicht hervor und muss je Fonds gewählt werden.
- REITs werden wie Aktien behandelt.

## Aufbau

```
index.html            Oberfläche
impressum.html        Impressum
datenschutz.html      Datenschutzhinweis
tests.html            Tests des Rechenkerns, im Browser öffnen
js/core/money.js      Rechnen in Cent, Formatierung
js/core/flex.js       Einlesen des Flex-Query-XML
js/core/fifo.js       FIFO je Wertpapier, Aktiensplits
js/core/vorab.js      Vorabpauschale je Anteil wie im Vordruck
js/core/report.js     Formularwerte, offene Punkte, CSV
js/core/forms.js      Zeilennummern je Steuerjahr
js/ui/app.js          Anzeige
beispiele/beispiel.js Erfundene Beispieldaten
tests/tests.js        Tests mit von Hand gerechneten Erwartungswerten
```

Es gibt keinen Build-Schritt und keine Abhängigkeiten.

## Tests

`tests.html` im Browser öffnen. Die Erwartungswerte sind von Hand gerechnet, die Rechnung steht als Kommentar über dem jeweiligen Test.

## Lizenz

GNU Affero General Public License v3.0 (AGPL-3.0). Der vollständige Text steht in der Datei `LICENSE`.

## Nächste Schritte

1. Mit einem echten Export prüfen und mit dem Steuerbericht vergleichen, den IBKR selbst anbietet.
2. Rechenlogik von einem Steuerberater durchsehen lassen.
3. Frühere Vorabpauschalen beim Verkauf von Fonds abziehen.
4. Optionen (Stillhalterprämien, Termingeschäfte).
5. Weitere Broker.
