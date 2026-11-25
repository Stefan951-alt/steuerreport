/* Oberfläche: Dateien laden, Steuerjahr wählen, Bericht anzeigen. Gerechnet wird ausschließlich in js/core.
   Inhalte aus der XML-Datei werden nur als Text eingesetzt, nie als HTML. */
(function () {
  'use strict';
  const K = window.KapReport;
  const M = K.money;
  const R = K.report;
  const STORE_KEY = 'kapreport.wertpapierarten.v1';
  const PRICE_KEY = 'kapreport.fondspreise.v1';
  const LEVELS = [
    { id: 'offen', badge: 'Offen', title: 'Offen – fehlt in den Summen' },
    { id: 'pruefen', badge: 'Prüfen', title: 'Prüfen – berechnet mit einer Annahme' },
    { id: 'info', badge: 'Hinweis', title: 'Hinweise' }
  ];

  const state = { files: [], errors: [], userTypes: readStore(STORE_KEY), userPrices: readStore(PRICE_KEY), year: null, open: new Set(), report: null };
  let fileSeq = 0;
  let printing = false;
  const $ = id => document.getElementById(id);

  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (e) {
      return {};
    }
  }
  function saveStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ohne Speicher gelten Auswahl und Eingaben nur für diese Sitzung */ }
  }
  function saveTypes() {
    saveStore(STORE_KEY, state.userTypes);
  }

  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return el;
  }

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const hasAmount = i => i.cents !== null && i.cents !== undefined;

  /* ---------- Dateien ---------- */

  function addParsed(name, xml, sample) {
    const statements = K.flex.parse(xml, name, ++fileSeq);
    state.files = state.files.filter(f => f.name !== name && f.sample === sample);
    state.files.push({ name: name, statements: statements, sample: sample });
  }

  async function addFiles(fileList) {
    state.errors = [];
    for (const file of Array.from(fileList)) {
      try {
        addParsed(file.name, await file.text(), false);
      } catch (err) {
        const known = err && err.name === 'FlexError';
        state.errors.push({ name: file.name, message: known ? err.message : 'Die Datei konnte nicht gelesen werden (' + ((err && err.message) || err) + ').' });
      }
    }
    render();
  }

  function loadSample() {
    state.errors = [];
    state.files = [];
    K.samples.forEach(s => addParsed(s.name, s.xml, true));
    render();
  }

  function renderErrors() {
    const host = $('errors');
    host.textContent = '';
    state.errors.forEach(function (e) {
      host.appendChild(h('div', { class: 'notice bad', role: 'alert' }, [h('strong', { text: e.name }), e.message]));
    });
  }

  function renderFiles() {
    const host = $('files');
    host.textContent = '';
    $('clear').hidden = !state.files.length;
    state.files.forEach(function (f) {
      const meta = f.statements.map(function (s) {
        return 'Konto ' + s.accountId + ', ' + M.fmtDate(s.from) + ' bis ' + M.fmtDate(s.to) + ' · ' +
          plural(s.trades.length, 'Geschäft', 'Geschäfte') + ' · ' + plural(s.cash.length, 'Buchung', 'Buchungen');
      }).join(' / ');
      host.appendChild(h('li', null, [
        h('span', null, [
          h('span', { class: 'name', text: f.name }),
          f.sample ? h('span', { class: 'tag', text: 'erfundenes Beispiel' }) : null,
          h('span', { class: 'meta', text: meta })
        ]),
        h('button', {
          type: 'button', class: 'btn ghost small', text: 'Entfernen', 'aria-label': f.name + ' entfernen',
          onclick: function () {
            state.files = state.files.filter(x => x !== f);
            render();
          }
        })
      ]));
    });
  }

  /* ---------- Bericht ---------- */

  function defaultYear(years) {
    const lastYear = new Date().getFullYear() - 1;
    return years.indexOf(lastYear) >= 0 ? lastYear : years[0];
  }

  function itemsTable(items) {
    const amounts = items.some(hasAmount);
    return h('div', { class: 'scroll' }, [h('table', null, [
      h('thead', null, [h('tr', null, [
        h('th', { text: 'Datum' }), h('th', { text: 'Wertpapier' }), h('th', { text: 'Vorgang' }),
        amounts ? h('th', { class: 'num', text: 'Betrag €' }) : null
      ])]),
      h('tbody', null, items.map(i => h('tr', null, [
        h('td', { class: 'nowrap', text: M.fmtDate(i.date) }),
        h('td', { class: 'sec', text: i.security }),
        h('td', { text: i.text }),
        amounts ? h('td', { class: 'num', text: hasAmount(i) ? M.fmtCents(i.cents) : '' }) : null
      ])))
    ])]);
  }

  // Zeigt, aus welchen Arten von Buchungen sich eine Zeile zusammensetzt (z. B. Dividenden, Zinsen, Verkäufe).
  function breakdown(items) {
    const byArt = new Map();
    items.forEach(i => byArt.set(i.art, (byArt.get(i.art) || 0) + i.cents));
    if (byArt.size < 2) return null;
    return h('div', { class: 'chips' }, Array.from(byArt.entries()).map(e => h('span', { class: 'chip', text: e[0] + ' ' + M.fmtCents(e[1]) + ' €' })));
  }

  function lineView(l) {
    const key = l.form + ':' + l.line + ':' + l.label;
    const head = [
      h('span', { class: 'zeile' }, [h('small', { text: 'Zeile' }), h('b', { text: l.line })]),
      h('span', null, [
        h('span', { class: 'line-label', text: l.label }),
        h('span', { class: 'line-sub' }, [
          l.items.length ? h('span', { class: 'more', text: plural(l.items.length, 'Buchung', 'Buchungen') }) : 'Keine Buchungen',
          l.note ? ' · ' + l.note : ''
        ])
      ]),
      h('span', { class: 'betrag', text: M.fmtCents(l.cents) + ' €' })
    ];
    if (!l.items.length) return h('div', { class: 'line zero' }, [h('div', { class: 'line-head' }, head)]);
    return h('details', {
      class: 'line', open: state.open.has(key),
      ontoggle: function (ev) {
        if (printing) return;
        if (ev.target.open) state.open.add(key);
        else state.open.delete(key);
      }
    }, [
      h('summary', { class: 'line-head' }, head),
      h('div', { class: 'line-body' }, [breakdown(l.items), itemsTable(l.items)])
    ]);
  }

  function sectionView(section, report) {
    return h('section', { class: 'card' }, [
      h('h2', null, [section.title + ' ', h('span', { class: 'year', text: String(report.year) })]),
      section.note ? h('p', { class: 'section-note', text: section.note }) : null,
      h('div', { class: 'lines' }, section.lines.map(lineView))
    ]);
  }

  function statusView(report) {
    const c = report.counts;
    if (report.complete) {
      return h('div', { class: 'status good' }, [
        h('h2', { text: 'Alles berechnet' }),
        h('p', null, [
          'Alle geladenen Buchungen für ' + report.year + ' sind in den Werten enthalten.' +
          (c.pruefen ? ' ' + plural(c.pruefen, 'Punkt beruht', 'Punkte beruhen') + ' auf einer Annahme, die du prüfen solltest.' : '')
        ])
      ]);
    }
    return h('div', { class: 'status bad' }, [
      h('h2', { text: 'Noch nicht vollständig' }),
      h('p', null, [
        plural(c.offen, 'offener Punkt', 'offene Punkte') + ': Die Werte unten enthalten nur, was sicher berechnet werden konnte. Übernimm sie erst, wenn die ',
        h('a', { href: '#punkte', text: 'offenen Punkte' }),
        ' geklärt sind.'
      ])
    ]);
  }

  function warningView(w, level) {
    return h('article', { class: 'warn ' + w.level }, [
      h('h3', null, [h('span', { class: 'badge', text: level.badge }), w.title]),
      h('p', { text: w.text }),
      w.items.length ? h('details', null, [
        h('summary', { text: plural(w.items.length, 'Eintrag', 'Einträge') + ' anzeigen' }),
        itemsTable(w.items)
      ]) : null
    ]);
  }

  function warningsView(report) {
    const kids = [h('h2', null, ['Offene Punkte und Hinweise ', h('span', { class: 'year', text: String(report.year) })])];
    if (!report.warnings.length) kids.push(h('p', { class: 'muted', text: 'Keine.' }));
    LEVELS.forEach(function (level) {
      const list = report.warnings.filter(w => w.level === level.id);
      if (!list.length) return;
      kids.push(h('p', { class: 'group-title', text: level.title }));
      list.forEach(w => kids.push(warningView(w, level)));
    });
    return h('section', { class: 'card', id: 'punkte' }, kids);
  }

  function typeLabel(type) {
    const t = R.TYPES[type];
    return t.teilfreistellung === undefined ? t.label : t.label + ' (' + t.teilfreistellung + ' % Teilfreistellung)';
  }

  function securitiesView(model) {
    const rows = Array.from(model.securities.values())
      .filter(sec => R.COMPUTED_ASSETS[sec.assetCategory])
      .map(function (sec) {
        const resolved = R.resolveType(sec, state.userTypes);
        const auto = R.resolveType(sec, {}).type;
        return { sec: sec, auto: auto, chosen: resolved.source === 'user' ? resolved.type : '', todo: resolved.source === 'auto' && auto !== 'aktie' };
      })
      .sort((a, b) => (Number(b.todo) - Number(a.todo)) || (a.sec.symbol || '').localeCompare(b.sec.symbol || ''));
    if (!rows.length) return null;

    const autoText = { aktie: 'Automatisch: Aktie', fonds_offen: 'Fonds – bitte Art wählen', unbekannt: 'Bitte wählen' };
    const body = rows.map(function (row) {
      const key = R.typeKey(row.sec);
      const select = h('select', {
        'aria-label': 'Art von ' + (row.sec.symbol || key),
        onchange: function (ev) {
          if (ev.target.value) state.userTypes[key] = ev.target.value;
          else delete state.userTypes[key];
          saveTypes();
          renderResult();
        }
      }, [h('option', { value: '', text: autoText[row.auto] || 'Bitte wählen' })].concat(
        R.SELECTABLE_TYPES.map(t => h('option', { value: t, text: typeLabel(t) }))
      ));
      select.value = row.chosen;
      return h('tr', { class: row.todo ? 'todo' : null }, [
        h('td', null, [h('strong', { text: row.sec.symbol || '–' }), h('span', { class: 'desc', text: row.sec.description || '' })]),
        h('td', { class: 'nowrap', text: row.sec.isin || '–' }),
        h('td', { text: [row.sec.assetCategory, row.sec.subCategory].filter(Boolean).join(' / ') || '–' }),
        h('td', null, [select])
      ]);
    });

    return h('section', { class: 'card', id: 'wertpapiere' }, [
      h('h2', { text: 'Wertpapiere einordnen' }),
      h('p', { class: 'section-note', text: 'Bei Fonds entscheidet die Fondsart über die Formularzeile. Sie steht in den Unterlagen des Anbieters unter dem Stichwort Teilfreistellung. Deine Auswahl wird in diesem Browser gespeichert.' }),
      h('div', { class: 'scroll' }, [h('table', { class: 'securities' }, [
        h('thead', null, [h('tr', null, [h('th', { text: 'Wertpapier' }), h('th', { text: 'ISIN' }), h('th', { text: 'Angabe von IBKR' }), h('th', { text: 'Einordnung' })])]),
        h('tbody', null, body)
      ])])
    ]);
  }

  function setPrice(key, year, which, value) {
    const byYear = state.userPrices[key] = state.userPrices[key] || {};
    const entry = byYear[year] = byYear[year] || {};
    if (value) entry[which] = value;
    else delete entry[which];
    if (!Object.keys(entry).length) delete byYear[year];
    if (!Object.keys(byYear).length) delete state.userPrices[key];
    saveStore(PRICE_KEY, state.userPrices);
    renderResult();
  }

  // Die Vorabpauschale braucht je Fonds und Jahr zwei Preise, die der Export nicht immer enthält. Hier lassen sie sich eintragen.
  function pricesView(report) {
    const byRow = new Map();
    report.vorab.funds.forEach(function (f) {
      const id = f.key + '|' + f.year;
      const row = byRow.get(id) || { fund: f, cents: null, abzug: null, open: '' };
      if (f.status === 'berechnet') row.cents = (row.cents || 0) + f.cents;
      else if (f.status !== 'bereit') row.open = row.open || f.status;
      if (f.abzug !== null) row.abzug = (row.abzug || 0) + f.abzug;
      byRow.set(id, row);
    });
    if (!byRow.size) return null;

    const field = function (fund, which, label) {
      const fromExport = which === 'beginn' ? fund.exportBeginn : fund.exportEnde;
      const typed = fund.eingabe[which];
      const bad = typed !== '' && !(M.parseEuro(typed) > 0);
      const hint = bad ? 'Bitte als Betrag mit Komma schreiben, zum Beispiel 88,50.'
        : fromExport !== null ? 'Aus dem Export: ' + M.fmtCents(fromExport) + ' €' : 'Nicht im Export';
      return h('td', null, [
        h('input', {
          type: 'text', inputmode: 'decimal', class: 'price' + (bad ? ' bad' : ''), value: typed,
          placeholder: fromExport !== null ? M.fmtCents(fromExport) : '0,00', 'aria-label': label + ' ' + fund.year + ' von ' + fund.security,
          onchange: ev => setPrice(fund.key, fund.year, which, ev.target.value.trim())
        }),
        h('span', { class: 'desc', text: hint })
      ]);
    };
    const statusText = { bestand: 'Von Hand zu rechnen', preise: 'Preis fehlt' };
    const body = Array.from(byRow.values()).map(function (row) {
      const result = [];
      if (row.open) result.push(statusText[row.open] || 'Offen');
      else if (row.cents !== null) result.push('Vorabpauschale ' + M.fmtCents(row.cents) + ' €');
      if (row.abzug !== null) result.push('Abzug beim Verkauf ' + M.fmtCents(row.abzug) + ' €');
      return h('tr', { class: row.open ? 'todo' : null }, [
        h('td', null, [h('strong', { text: row.fund.security })]),
        h('td', { text: String(row.fund.year) }),
        field(row.fund, 'beginn', 'Preis zu Jahresbeginn'),
        field(row.fund, 'ende', 'Letzter Preis'),
        h('td', { class: 'num', text: result.join(' · ') })
      ]);
    });

    return h('section', { class: 'card', id: 'fondspreise' }, [
      h('h2', { text: 'Fondspreise für die Vorabpauschale' }),
      h('p', { class: 'section-note', text: 'Der Vordruck verlangt je Fonds den Preis eines Anteils zu Beginn und am Ende des Jahres, jeweils in Euro. Frühere Jahre stehen hier, wenn du Anteile verkauft hast: Die Vorabpauschalen aus der Haltezeit mindern den Gewinn. Leere Felder nehmen den Wert aus dem Export, soweit er dort steht. Deine Eingaben werden in diesem Browser gespeichert.' }),
      h('div', { class: 'scroll' }, [h('table', { class: 'securities' }, [
        h('thead', null, [h('tr', null, [
          h('th', { text: 'Fonds' }), h('th', { text: 'Jahr' }), h('th', { text: 'Preis zu Jahresbeginn €' }), h('th', { text: 'Letzter Preis €' }), h('th', { class: 'num', text: 'Ergebnis' })
        ])]),
        h('tbody', null, body)
      ])])
    ]);
  }

  function downloadCsv() {
    if (!state.report) return;
    const blob = new Blob([R.toCsv(state.report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: 'steuerreport-' + state.report.year + '.csv' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toolbarView(model) {
    const select = h('select', {
      id: 'jahr',
      onchange: function (ev) {
        state.year = Number(ev.target.value);
        renderResult();
      }
    }, model.years.map(y => h('option', { value: String(y), text: String(y) })));
    select.value = String(state.year);
    return h('div', { class: 'toolbar' }, [
      h('label', { for: 'jahr' }, ['Steuerjahr', select]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn ghost', text: 'Als CSV speichern', onclick: downloadCsv }),
        h('button', { type: 'button', class: 'btn', text: 'Drucken oder als PDF sichern', onclick: () => window.print() })
      ])
    ]);
  }

  function renderResult() {
    const host = $('result');
    host.textContent = '';
    state.report = null;
    if (!state.files.length) return;
    try {
      const statements = [];
      state.files.forEach(f => f.statements.forEach(s => statements.push(s)));
      const model = R.buildModel(statements);
      if (model.years.indexOf(state.year) < 0) state.year = defaultYear(model.years);
      const report = R.buildReport(model, state.userTypes, state.year, state.userPrices);
      state.report = report;
      [toolbarView(model), statusView(report)]
        .concat(report.sections.map(s => sectionView(s, report)), [warningsView(report), pricesView(report), securitiesView(model)])
        .forEach(function (node) {
          if (node) host.appendChild(node);
        });
    } catch (err) {
      host.appendChild(h('div', { class: 'notice bad', role: 'alert' }, [
        h('strong', { text: 'Die Auswertung ist fehlgeschlagen' }),
        String((err && err.message) || err)
      ]));
    }
  }

  function render() {
    renderErrors();
    renderFiles();
    renderResult();
  }

  /* ---------- Ereignisse ---------- */

  const drop = $('drop');
  const input = $('file');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      input.click();
    }
  });
  ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, function (ev) {
    ev.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, function (ev) {
    ev.preventDefault();
    drop.classList.remove('over');
  }));
  drop.addEventListener('drop', ev => addFiles(ev.dataTransfer.files));
  input.addEventListener('change', function () {
    addFiles(input.files);
    input.value = '';
  });
  $('sample').addEventListener('click', loadSample);
  $('clear').addEventListener('click', function () {
    state.files = [];
    state.errors = [];
    render();
  });

  // Im Ausdruck sollen alle Herleitungen sichtbar sein, danach wieder der Zustand von vorher.
  window.addEventListener('beforeprint', function () {
    printing = true;
    document.querySelectorAll('#result details').forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => setTimeout(function () {
    printing = false;
    renderResult();
  }, 50));

  render();
})();
