/* Erfundene Beispieldaten im Format eines Activity Flex Query. Konto, Wertpapiere und Beträge gibt es nicht.
   Die erwarteten Ergebnisse stehen als Handrechnung in tests/tests.js. */
(function (root) {
  'use strict';
  const K = root.KapReport = root.KapReport || {};

  const xml2024 = `<FlexQueryResponse queryName="Steuerreport (erfundene Beispieldaten)" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="U0000000" fromDate="20240101" toDate="20241231" period="LastYear" whenGenerated="20250105;101500">
<AccountInformation accountId="U0000000" currency="EUR" name="Beispielkonto" />
<Trades>
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.92" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME BEISPIEL INC" conid="1001" isin="US0000001001" tradeID="900001" dateTime="20240311;153000" tradeDate="20240311" transactionType="ExchTrade" quantity="20" tradePrice="100" proceeds="-2000" taxes="0" ibCommission="-1" ibCommissionCurrency="USD" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="ETF" symbol="WELT" description="BEISPIEL WELT AKTIEN UCITS ETF" conid="2001" isin="IE0000002001" tradeID="900002" dateTime="20240402;101500" tradeDate="20240402" transactionType="ExchTrade" quantity="30" tradePrice="80" proceeds="-2400" taxes="0" ibCommission="-1.25" ibCommissionCurrency="EUR" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.93" assetCategory="STK" subCategory="COMMON" symbol="BETA" description="BETA BEISPIEL CORP" conid="1002" isin="US0000001002" tradeID="900003" dateTime="20240506;160000" tradeDate="20240506" transactionType="ExchTrade" quantity="15" tradePrice="50" proceeds="-750" taxes="0" ibCommission="-1" ibCommissionCurrency="USD" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.93" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME BEISPIEL INC" conid="1001" isin="US0000001001" tradeID="900004" dateTime="20240603;154500" tradeDate="20240603" transactionType="ExchTrade" quantity="10" tradePrice="120" proceeds="-1200" taxes="0" ibCommission="-1" ibCommissionCurrency="USD" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="CHF" fxRateToBase="1.06" assetCategory="STK" subCategory="COMMON" symbol="ALPEN" description="ALPEN BEISPIEL AG" conid="1003" isin="CH0000001003" tradeID="900005" dateTime="20240902;093000" tradeDate="20240902" transactionType="ExchTrade" quantity="8" tradePrice="200" proceeds="-1600" taxes="0" ibCommission="-5" ibCommissionCurrency="CHF" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
</Trades>
<CashTransactions>
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.91" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.25 PER SHARE (Ordinary Dividend)" conid="1001" isin="US0000001001" dateTime="20240815" settleDate="20240815" amount="7.5" type="Dividends" transactionID="800001" reportDate="20240815" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.91" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.25 PER SHARE - US TAX" conid="1001" isin="US0000001001" dateTime="20240815" settleDate="20240815" amount="-1.13" type="Withholding Tax" transactionID="800002" reportDate="20240815" levelOfDetail="DETAIL" />
</CashTransactions>
<CorporateActions />
<OpenPositions>
<OpenPosition accountId="U0000000" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME BEISPIEL INC" conid="1001" isin="US0000001001" reportDate="20241231" position="30" markPrice="130" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="EUR" assetCategory="STK" subCategory="ETF" symbol="WELT" description="BEISPIEL WELT AKTIEN UCITS ETF" conid="2001" isin="IE0000002001" reportDate="20241231" position="30" markPrice="88" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="BETA" description="BETA BEISPIEL CORP" conid="1002" isin="US0000001002" reportDate="20241231" position="15" markPrice="44" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="CHF" assetCategory="STK" subCategory="COMMON" symbol="ALPEN" description="ALPEN BEISPIEL AG" conid="1003" isin="CH0000001003" reportDate="20241231" position="8" markPrice="210" levelOfDetail="SUMMARY" />
</OpenPositions>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`;

  const xml2025 = `<FlexQueryResponse queryName="Steuerreport (erfundene Beispieldaten)" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="U0000000" fromDate="20250101" toDate="20251231" period="LastYear" whenGenerated="20260105;101500">
<AccountInformation accountId="U0000000" currency="EUR" name="Beispielkonto" />
<Trades>
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.92" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME BEISPIEL INC" conid="1001" isin="US0000001001" tradeID="910001" dateTime="20250314;161000" tradeDate="20250314" transactionType="ExchTrade" quantity="-50" tradePrice="70" proceeds="3500" taxes="0" ibCommission="-1.5" ibCommissionCurrency="USD" openCloseIndicator="C" buySell="SELL" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.9" assetCategory="CASH" subCategory="" symbol="EUR.USD" description="EUR.USD" conid="4001" isin="" tradeID="910002" dateTime="20250317;090000" tradeDate="20250317" transactionType="ExchTrade" quantity="2700" tradePrice="1.1111" proceeds="-3000" taxes="0" ibCommission="-1.8" ibCommissionCurrency="EUR" openCloseIndicator="" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.89" assetCategory="STK" subCategory="COMMON" symbol="BETA" description="BETA BEISPIEL CORP" conid="1002" isin="US0000001002" tradeID="910003" dateTime="20250520;170500" tradeDate="20250520" transactionType="ExchTrade" quantity="-15" tradePrice="40" proceeds="600" taxes="0" ibCommission="-1" ibCommissionCurrency="USD" openCloseIndicator="C" buySell="SELL" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="USD" fxRateToBase="0.88" assetCategory="OPT" subCategory="C" symbol="ACME  260116C00080000" description="ACME 16JAN26 80 C" conid="3001" isin="" tradeID="910004" dateTime="20250610;155000" tradeDate="20250610" transactionType="ExchTrade" quantity="-1" tradePrice="1.5" proceeds="150" taxes="0" ibCommission="-1" ibCommissionCurrency="USD" openCloseIndicator="O" buySell="SELL" notes="" multiplier="100" strike="80" expiry="20260116" putCall="C" underlyingConid="1001" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="ETF" symbol="WELT" description="BEISPIEL WELT AKTIEN UCITS ETF" conid="2001" isin="IE0000002001" tradeID="910005" dateTime="20250701;110000" tradeDate="20250701" transactionType="ExchTrade" quantity="-10" tradePrice="95" proceeds="950" taxes="0" ibCommission="-1.25" ibCommissionCurrency="EUR" openCloseIndicator="C" buySell="SELL" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="MUSTER" description="MUSTER BEISPIEL AG" conid="1004" isin="DE0000001004" tradeID="910006" dateTime="20250804;093500" tradeDate="20250804" transactionType="ExchTrade" quantity="5" tradePrice="60" proceeds="-300" taxes="0" ibCommission="-1.25" ibCommissionCurrency="EUR" openCloseIndicator="O" buySell="BUY" notes="" levelOfDetail="EXECUTION" />
<Trade accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="MUSTER" description="MUSTER BEISPIEL AG" conid="1004" isin="DE0000001004" tradeID="910007" dateTime="20251103;141500" tradeDate="20251103" transactionType="ExchTrade" quantity="-5" tradePrice="70" proceeds="350" taxes="0" ibCommission="-1.25" ibCommissionCurrency="EUR" openCloseIndicator="C" buySell="SELL" notes="" levelOfDetail="EXECUTION" />
</Trades>
<CashTransactions>
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="" symbol="" description="EUR CREDIT INT FOR DEC-2024" conid="" isin="" dateTime="20250105" settleDate="20250105" amount="3.21" type="Broker Interest Received" transactionID="810001" reportDate="20250105" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.95" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.25 PER SHARE (Ordinary Dividend)" conid="1001" isin="US0000001001" dateTime="20250214" settleDate="20250214" amount="7.5" type="Dividends" transactionID="810002" reportDate="20250214" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.95" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.25 PER SHARE - US TAX" conid="1001" isin="US0000001001" dateTime="20250214" settleDate="20250214" amount="-1.13" type="Withholding Tax" transactionID="810003" reportDate="20250214" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="CHF" fxRateToBase="1.05" assetCategory="STK" subCategory="COMMON" symbol="ALPEN" description="ALPEN(CH0000001003) CASH DIVIDEND CHF 5.00 PER SHARE (Ordinary Dividend)" conid="1003" isin="CH0000001003" dateTime="20250410" settleDate="20250410" amount="40" type="Dividends" transactionID="810004" reportDate="20250410" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="CHF" fxRateToBase="1.05" assetCategory="STK" subCategory="COMMON" symbol="ALPEN" description="ALPEN(CH0000001003) CASH DIVIDEND CHF 5.00 PER SHARE - CH TAX" conid="1003" isin="CH0000001003" dateTime="20250410" settleDate="20250410" amount="-14" type="Withholding Tax" transactionID="810005" reportDate="20250410" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.9" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.15 PER SHARE (Ordinary Dividend)" conid="1001" isin="US0000001001" dateTime="20250515" settleDate="20250515" amount="1.5" type="Dividends" transactionID="810006" reportDate="20250515" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.9" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) CASH DIVIDEND USD 0.15 PER SHARE - US TAX" conid="1001" isin="US0000001001" dateTime="20250515" settleDate="20250515" amount="-0.23" type="Withholding Tax" transactionID="810007" reportDate="20250515" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="ETF" symbol="WELT" description="WELT(IE0000002001) CASH DIVIDEND EUR 0.50 PER SHARE (Ordinary Dividend)" conid="2001" isin="IE0000002001" dateTime="20250616" settleDate="20250616" amount="15" type="Dividends" transactionID="810008" reportDate="20250616" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="USD" fxRateToBase="0.85" assetCategory="" symbol="" description="USD CREDIT INT FOR JUN-2025" conid="" isin="" dateTime="20250703" settleDate="20250703" amount="2" type="Broker Interest Received" transactionID="810009" reportDate="20250703" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="" symbol="" description="EUR DEBIT INT FOR JUL-2025" conid="" isin="" dateTime="20250805" settleDate="20250805" amount="-0.8" type="Broker Interest Paid" transactionID="810010" reportDate="20250805" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="MUSTER" description="MUSTER(DE0000001004) CASH DIVIDEND EUR 1.00 PER SHARE (Ordinary Dividend)" conid="1004" isin="DE0000001004" dateTime="20250910" settleDate="20250910" amount="5" type="Dividends" transactionID="810011" reportDate="20250910" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="COMMON" symbol="MUSTER" description="MUSTER(DE0000001004) CASH DIVIDEND EUR 1.00 PER SHARE - DE TAX" conid="1004" isin="DE0000001004" dateTime="20250910" settleDate="20250910" amount="-1.32" type="Withholding Tax" transactionID="810012" reportDate="20250910" levelOfDetail="DETAIL" />
<CashTransaction accountId="U0000000" currency="EUR" fxRateToBase="1" assetCategory="" symbol="" description="MARKTDATEN OKT-2025" conid="" isin="" dateTime="20251003" settleDate="20251003" amount="-4.5" type="Other Fees" transactionID="810013" reportDate="20251003" levelOfDetail="DETAIL" />
</CashTransactions>
<CorporateActions>
<CorporateAction accountId="U0000000" currency="USD" fxRateToBase="0.96" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME(US0000001001) SPLIT 2 FOR 1 (ACME, ACME BEISPIEL INC, US0000001001)" actionDescription="ACME(US0000001001) SPLIT 2 FOR 1 (ACME, ACME BEISPIEL INC, US0000001001)" conid="1001" isin="US0000001001" reportDate="20250210" dateTime="20250207;202500" amount="0" proceeds="0" value="0" quantity="30" type="FS" transactionID="710001" levelOfDetail="DETAIL" />
</CorporateActions>
<OpenPositions>
<OpenPosition accountId="U0000000" currency="USD" assetCategory="STK" subCategory="COMMON" symbol="ACME" description="ACME BEISPIEL INC" conid="1001" isin="US0000001001" reportDate="20251231" position="10" markPrice="74" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="EUR" assetCategory="STK" subCategory="ETF" symbol="WELT" description="BEISPIEL WELT AKTIEN UCITS ETF" conid="2001" isin="IE0000002001" reportDate="20251231" position="20" markPrice="97" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="CHF" assetCategory="STK" subCategory="COMMON" symbol="ALPEN" description="ALPEN BEISPIEL AG" conid="1003" isin="CH0000001003" reportDate="20251231" position="8" markPrice="205" levelOfDetail="SUMMARY" />
<OpenPosition accountId="U0000000" currency="USD" assetCategory="OPT" subCategory="C" symbol="ACME  260116C00080000" description="ACME 16JAN26 80 C" conid="3001" isin="" reportDate="20251231" position="-1" markPrice="0.4" levelOfDetail="SUMMARY" />
</OpenPositions>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`;

  K.samples = [
    { name: 'beispiel-2024.xml', xml: xml2024 },
    { name: 'beispiel-2025.xml', xml: xml2025 }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
