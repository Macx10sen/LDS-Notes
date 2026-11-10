(function () {
  'use strict';

  const SCHEMAS = window.SCHEMAS;
  const STORE_KEY = 'churchNotes.v1';
  const LINE = 32; // px; must match --line in styles.css
  const app = document.getElementById('app');
  // Present when running inside the Android app (see android/).
  const native = () => window.LDNotebook;
  const ANDROID_APK = 'https://github.com/Macx10sen/LDS-Notes/releases/latest/download/LDNotebook.apk';

  /* ---------- helpers ---------- */

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  function fmtDate(iso, long) {
    if (!iso) return 'No date';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, long
      ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtTime(t) {
    if (!t) return '';
    const [hh, mm] = t.split(':').map(Number);
    return new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function hasContent(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.some(hasContent);
    if (typeof v === 'object') return Object.values(v).some(hasContent);
    return false;
  }

  const isEmpty = (note) =>
    !Object.entries(note.data).some(([k, v]) => !['date', 'time', 'kind', 'source'].includes(k) && hasContent(v));

  function flatFields(fields) {
    return fields.flatMap((f) => (f.type === 'row' || f.type === 'col' ? flatFields(f.fields) : [f]));
  }

  // Older Sunday notes had a single Second Hour class; move it into First Block.
  const OLD_SECOND_HOUR = {
    class: 'class', teacher: 'teacher', lesson: 'lesson', lessonTitle: 'lessonTitle',
    somethingILoved: 'somethingILoved', secondHourNotes: 'notes', secondHourPromptings: 'promptings',
  };
  function migrate(n) {
    if (!n || n.type !== 'sunday' || !n.data || Array.isArray(n.data.blocks)) return n;
    const first = {};
    for (const [oldKey, newKey] of Object.entries(OLD_SECOND_HOUR)) {
      if (oldKey in n.data) {
        first[newKey] = n.data[oldKey];
        delete n.data[oldKey];
      }
    }
    n.data.blocks = [first, {}];
    return n;
  }

  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // Two-tap confirm (in-page, since some embedded views block confirm()).
  function armed(btn, prompt, action) {
    if (btn.dataset.armed) { action(); return; }
    const orig = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = prompt;
    btn.classList.add('armed');
    setTimeout(() => {
      if (!btn.isConnected) return;
      delete btn.dataset.armed;
      btn.textContent = orig;
      btn.classList.remove('armed');
    }, 3000);
  }

  /* ---------- storage ---------- */

  const Store = {
    all() {
      try {
        const v = JSON.parse(localStorage.getItem(STORE_KEY));
        return Array.isArray(v) ? v.map(migrate) : [];
      } catch (e) {
        return [];
      }
    },
    saveAll(notes) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(notes));
        return true;
      } catch (e) {
        toast('Could not save — storage is full or unavailable.');
        return false;
      }
    },
    get(id) {
      return this.all().find((n) => n.id === id);
    },
    put(note) {
      const all = this.all();
      const i = all.findIndex((n) => n.id === note.id);
      if (i >= 0) all[i] = note;
      else all.push(note);
      return this.saveAll(all);
    },
    remove(id) {
      this.saveAll(this.all().filter((n) => n.id !== id));
    },
  };

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  /* ---------- note descriptions ---------- */

  function checksText(v) {
    if (!v) return [];
    return [...(v.selected || []), ...(v.other && v.other.trim() ? [v.other.trim()] : [])];
  }

  function kindLabel(note) {
    const kinds = SCHEMAS[note.type].kinds || [];
    const match = kinds.find(([k]) => k === note.data.kind);
    return match ? match[1] : '';
  }

  function pageTitle(page, d) {
    return typeof page.title === 'function' ? page.title(d) : page.title;
  }

  function blockLabels(f, d, long) {
    return typeof f.labels === 'function' ? f.labels(d, long) : f.labels;
  }

  function describe(note) {
    const d = note.data;
    if (note.type === 'study') {
      if (d.kind === 'personal' && d.source === 'other') {
        const theme = (d.studyTheme || '').trim();
        return {
          kicker: 'Personal Study' + (theme ? ` · ${theme}` : ''),
          title: (d.studyName || '').trim() || theme || 'Personal Study',
        };
      }
      return {
        kicker: kindLabel(note) || 'Daily Study',
        title: (d.cfmReading || '').trim() || (d.weekTitle || '').trim() || 'Come, Follow Me',
      };
    }
    if (note.type === 'meeting') {
      const conf = checksText(d.conference);
      const sess = checksText(d.session);
      return {
        kicker: conf[0] || 'Meeting',
        title: sess.length ? sess.join(', ') : 'Meeting Notes',
      };
    }
    const lessons = (d.blocks || []).map((b) => (b && b.lessonTitle ? b.lessonTitle.trim() : '')).filter(Boolean);
    return {
      kicker: d.testimonyMeeting ? 'Sunday · Testimony Meeting' : 'Sunday',
      title: lessons.join(' · ') || 'Sacrament & Second Hour',
    };
  }

  function snippet(note) {
    const d = note.data;
    const names = (d.speakers || []).map((s) => s.name && s.name.trim()).filter(Boolean);
    if (names.length) return names.join(' · ');
    const read = (d.days || []).map((x) => x && x.scriptures && x.scriptures.trim()).filter(Boolean);
    if (read.length) return read.join(' · ');
    for (const f of SCHEMAS[note.type].pages.flatMap((p) => flatFields(p.fields))) {
      if (f.type === 'lines' && d[f.key] && d[f.key].trim()) return d[f.key].trim().slice(0, 140);
    }
    return '';
  }

  function fieldsText(fields, d) {
    const body = [];
    for (const f of flatFields(fields)) {
      if (f.show && !f.show(d)) continue;
      const v = d[f.key];
      if (f.type === 'blocks') {
        blockLabels(f, d, true).forEach((label, i) => {
          const sub = fieldsText(f.fields, (v && v[i]) || {});
          if (sub.length) body.push(`— ${label} —`, ...sub);
        });
      } else if (f.type === 'line' || f.type === 'lines') {
        if (hasContent(v)) body.push(`${f.label}${f.sublabel ? ' (' + f.sublabel + ')' : ''}:\n${v.trim()}`);
      } else if (f.type === 'checks') {
        const parts = checksText(v);
        const detail = f.detail && d[f.detail.key] && d[f.detail.key].trim();
        if (parts.length || detail) {
          body.push(`${f.label}: ${parts.join(', ')}${detail ? (parts.length ? ' — ' : '') + detail : ''}`);
        }
      } else if (f.type === 'speakers') {
        const list = (v || []).filter(hasContent);
        const flag = f.toggle && d[f.toggle.key];
        if (list.length || flag) {
          const lines = [`${f.label}${flag ? ' (' + f.toggle.label + ')' : ''}:`];
          for (const s of list) {
            lines.push(`• ${[s.name, s.topic].filter((x) => x && x.trim()).join(' — ')}`);
            if (s.notes && s.notes.trim()) lines.push(s.notes.trim().replace(/^/gm, '   '));
          }
          body.push(lines.join('\n'));
        }
      } else if (f.type === 'hearHim') {
        if (v) body.push(`${f.label}: ${v}`);
      } else if (f.type === 'cta') {
        if (hasContent(v)) {
          const lines = [`${f.label}:`];
          for (const [k, label] of CTA_ITEMS) {
            const item = v[k] || {};
            if (item.on || (item.text && item.text.trim())) {
              lines.push(`${item.on ? '☑' : '☐'} ${label}${item.text ? ': ' + item.text.trim() : ''}`);
            }
          }
          body.push(lines.join('\n'));
        }
      }
    }
    return body;
  }

  function noteToText(note) {
    const d = note.data;
    const desc = describe(note);
    const out = [`${desc.kicker} — ${desc.title}`];
    out.push([fmtDate(d.date, true), fmtTime(d.time), d.location].filter(Boolean).join(' · '));

    for (const page of SCHEMAS[note.type].pages) {
      const body = fieldsText(page.fields, d);
      if (body.length) out.push('', pageTitle(page, d).toUpperCase(), ...body.flatMap((b) => [b, '']));
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /* ---------- routing ---------- */

  let current = null; // { note, timer, page }
  const pageByNote = {};
  const blockByNote = {};

  function route() {
    const m = location.hash.match(/^#note-(.+)$/);
    if (m) renderEditor(decodeURIComponent(m[1]));
    else renderHome();
  }

  function leaveEditor() {
    if (!current) return;
    flush();
    if (isEmpty(current.note)) Store.remove(current.note.id);
    current = null;
  }

  function newNote(type, extra) {
    const now = new Date();
    let data = { date: isoDate(now), time: hhmm(now), location: '' };
    if (type === 'study') {
      // A study note is one Come, Follow Me week, starting Monday.
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      data = { date: isoDate(monday) };
    }
    const note = {
      id: uid(),
      type,
      created: Date.now(),
      updated: Date.now(),
      data: Object.assign(data, extra || {}),
    };
    Store.put(note);
    location.hash = `#note-${encodeURIComponent(note.id)}`;
  }

  /* ---------- home ---------- */

  let homeFilter = 'all';
  let homeQuery = '';

  function renderHome() {
    leaveEditor();
    document.title = 'Latter Day Notebook';
    const list = h('div', { class: 'note-list' });

    function draw() {
      const q = homeQuery.trim().toLowerCase();
      const notes = Store.all()
        .filter((n) => SCHEMAS[n.type])
        .filter((n) => homeFilter === 'all' || n.type === homeFilter)
        .filter((n) => !q || noteToText(n).toLowerCase().includes(q))
        .sort((a, b) => {
          const ka = `${a.data.date || ''} ${a.data.time || ''}`;
          const kb = `${b.data.date || ''} ${b.data.time || ''}`;
          return kb.localeCompare(ka) || b.created - a.created;
        });

      if (!notes.length) {
        list.replaceChildren(
          h('p', { class: 'empty' }, q || homeFilter !== 'all'
            ? 'No notes match.'
            : 'No notes yet. Start one above when the meeting begins.')
        );
        return;
      }
      list.replaceChildren(
        ...notes.map((n) => {
          const desc = describe(n);
          const snip = snippet(n);
          return h('a', { class: `note-card type-${n.type}`, href: `#note-${encodeURIComponent(n.id)}` },
            h('span', { class: 'kicker' }, desc.kicker),
            h('span', { class: 'card-title' }, desc.title),
            h('span', { class: 'card-date' }, [
              (n.type === 'study' ? 'Week of ' : '') + fmtDate(n.data.date),
              n.data.location,
            ].filter(Boolean).join(' · ')),
            snip && h('span', { class: 'card-snippet' }, snip)
          );
        })
      );
    }

    const filters = [['all', 'All'], ['sunday', 'Sundays'], ['meeting', 'Meetings'], ['study', 'Study']];
    const filterBar = h('div', { class: 'segmented', role: 'tablist' },
      filters.map(([k, label]) => h('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': String(homeFilter === k),
        onclick: (e) => {
          homeFilter = k;
          filterBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
          draw();
        },
      }, label))
    );

    const fileInput = h('input', { type: 'file', accept: 'application/json,.json,text/plain,.txt', hidden: true, onchange: importBackup });

    app.replaceChildren(
      h('div', { class: 'home' },
        h('header', { class: 'home-head' },
          h('h1', { class: 'display' }, 'Latter Day', h('br'), 'Notebook'),
          h('p', { class: 'sub' }, fmtDate(isoDate(new Date()), true))
        ),
        h('div', { class: 'new-grid' },
          Object.entries(SCHEMAS).map(([type, s]) =>
            h('button', {
              type: 'button',
              class: `new-btn type-${type}`,
              'aria-expanded': s.kinds ? 'false' : null,
              onclick: (e) => {
                if (!s.kinds) { newNote(type); return; }
                // Types with kinds (Daily Study) ask which kind first.
                const picker = document.getElementById(`picker-${type}`);
                picker.hidden = !picker.hidden;
                e.currentTarget.setAttribute('aria-expanded', String(!picker.hidden));
              },
            },
              h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
              h('span', { class: 'new-label' }, s.label),
              h('span', { class: 'new-blurb' }, s.blurb)
            )
          ),
          Object.entries(SCHEMAS).filter(([, s]) => s.kinds).map(([type, s]) =>
            h('div', { class: 'kind-picker', id: `picker-${type}`, hidden: true },
              h('p', { class: 'label' }, 'Start a week of'),
              h('div', { class: 'kind-buttons' },
                s.kinds.map(([k, label]) => h('button', {
                  type: 'button', class: 'kind-btn', onclick: () => newNote(type, { kind: k }),
                }, label))
              )
            )
          )
        ),
        h('div', { class: 'list-tools' },
          h('input', {
            type: 'search',
            class: 'search',
            placeholder: 'Search notes',
            'aria-label': 'Search notes',
            value: homeQuery,
            oninput: (e) => { homeQuery = e.target.value; draw(); },
          }),
          filterBar
        ),
        list,
        h('footer', { class: 'home-foot' },
          appearancePicker(),
          h('button', { type: 'button', class: 'link-btn', onclick: exportBackup }, 'Back up notes'),
          h('button', { type: 'button', class: 'link-btn', onclick: () => fileInput.click() }, 'Restore backup'),
          fileInput,
          h('p', { class: 'fine' }, 'Notes are saved only on this device. Back up now and then to keep them safe.'),
          /Android/i.test(navigator.userAgent) && !native() && window.self === window.top &&
            h('p', { class: 'fine' },
              h('a', { class: 'link-btn', href: ANDROID_APK }, 'Get the Android app'),
              ' (runs on its own, without Chrome)')
        )
      )
    );
    draw();
    window.scrollTo(0, 0);
  }

  /* ---------- appearance ---------- */

  const THEME_KEY = 'churchNotes.theme';
  const THEMES = [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['paper', 'Paper'],
  ];

  function getTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return THEMES.some(([k]) => k === t) ? t : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-appearance');
    else root.setAttribute('data-appearance', t);
    // Match the phone's status bar to the page.
    const bg = getComputedStyle(root).getPropertyValue('--paper').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.media) m.dataset.media = m.getAttribute('media') || '';
      if (t === 'system') {
        if (m.dataset.media) m.setAttribute('media', m.dataset.media);
        m.setAttribute('content', m.dataset.original || m.getAttribute('content'));
      } else {
        if (!m.dataset.original) m.dataset.original = m.getAttribute('content');
        m.removeAttribute('media');
        m.setAttribute('content', bg);
      }
    });
    // In the Android app, color the status and navigation bars too.
    if (native() && /^#[0-9a-f]{6}$/i.test(bg)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
      native().setSystemBars(bg, 0.299 * r + 0.587 * g + 0.114 * b > 140);
    }
  }

  function setTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* still applies for this visit */ }
    applyTheme(t);
  }

  function appearancePicker() {
    const current = getTheme();
    const bar = h('div', { class: 'segmented appearance', role: 'radiogroup', 'aria-label': 'Appearance' },
      THEMES.map(([k, label]) => h('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(k === current),
        'aria-selected': String(k === current),
        onclick: (e) => {
          setTheme(k);
          bar.querySelectorAll('button').forEach((b) => {
            const on = String(b === e.currentTarget);
            b.setAttribute('aria-checked', on);
            b.setAttribute('aria-selected', on);
          });
        },
      }, h('span', { class: `swatch swatch-${k}`, 'aria-hidden': 'true' }), label))
    );
    return h('div', { class: 'setting' }, h('h3', { class: 'label' }, 'Appearance'), bar);
  }

  /* ---------- backup ---------- */

  function exportBackup() {
    const notes = Store.all();
    if (!notes.length) { toast('There are no notes to back up yet.'); return; }
    if (native()) {
      const json = JSON.stringify({ app: 'latter-day-notebook', version: 1, exported: new Date().toISOString(), notes }, null, 2);
      const ok = native().shareFile(`latter-day-notebook-backup-${isoDate(new Date())}.json`, 'application/json', json);
      if (!ok) toast('Could not create the backup file.');
      return;
    }
    if (window.self !== window.top) {
      toast('Backups work in the installed app, not in this preview.');
      return;
    }
    const json = JSON.stringify({ app: 'latter-day-notebook', version: 1, exported: new Date().toISOString(), notes }, null, 2);
    const base = `latter-day-notebook-backup-${isoDate(new Date())}`;

    // Prefer the share sheet (Save to Files, Drive, email…). Android only shares
    // some file types, so fall back from .json to plain text, which it accepts.
    if (navigator.share && navigator.canShare) {
      const candidates = [];
      try {
        candidates.push(
          new File([json], `${base}.json`, { type: 'application/json' }),
          new File([json], `${base}.txt`, { type: 'text/plain' })
        );
      } catch (e) { /* File not supported; use the download below */ }
      const file = candidates.find((f) => {
        try { return navigator.canShare({ files: [f] }); } catch (e) { return false; }
      });
      if (file) {
        navigator.share({ files: [file], title: 'Latter Day Notebook backup' })
          .then(() => toast('Backup shared.'))
          .catch((err) => {
            if (err && err.name === 'AbortError') return; // closed the share sheet
            downloadBackup(json, `${base}.json`);
          });
        return;
      }
    }
    downloadBackup(json, `${base}.json`);
  }

  function downloadBackup(json, name) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`Saved ${name} to your Downloads.`);
  }

  function importBackup(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((text) => {
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed) ? parsed : parsed.notes;
      if (!Array.isArray(incoming)) throw new Error('bad file');
      const all = Store.all();
      let added = 0;
      let updated = 0;
      for (const n of incoming) {
        if (!n || !n.id || !SCHEMAS[n.type] || typeof n.data !== 'object') continue;
        const i = all.findIndex((x) => x.id === n.id);
        if (i < 0) { all.push(n); added++; }
        else if ((n.updated || 0) > (all[i].updated || 0)) { all[i] = n; updated++; }
      }
      if (Store.saveAll(all)) {
        toast(`Restored ${added} new note${added === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}.`);
        renderHome();
      }
    }).catch(() => toast('That file is not a Latter Day Notebook backup.'));
  }

  /* ---------- editor ---------- */

  function changed() {
    if (!current) return;
    current.note.updated = Date.now();
    setStatus('Saving…');
    clearTimeout(current.timer);
    current.timer = setTimeout(flush, 400);
  }

  function flush() {
    if (!current || !current.timer) return;
    clearTimeout(current.timer);
    current.timer = null;
    if (Store.put(current.note)) setStatus('Saved');
  }

  function setStatus(text) {
    const el = document.getElementById('save-status');
    if (el) el.textContent = text;
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    const min = LINE * Number(ta.getAttribute('rows') || 1);
    ta.style.height = Math.max(min, Math.ceil(ta.scrollHeight / LINE) * LINE) + 'px';
  }

  function fieldLabel(f, extra) {
    return h('div', { class: 'field-head' },
      h('h3', { class: 'label' }, f.label, f.sublabel && h('span', { class: 'sublabel' }, f.sublabel)),
      extra
    );
  }

  function linedTextarea(value, rows, ariaLabel, onInput, placeholder) {
    const ta = h('textarea', { rows, 'aria-label': ariaLabel, placeholder: placeholder || null, value: value || '' });
    ta.addEventListener('input', () => { onInput(ta.value); autoGrow(ta); });
    return h('div', { class: 'lined' }, ta);
  }

  function checkItem(text, checked, onChange) {
    const input = h('input', { type: 'checkbox', checked });
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'check' },
      input,
      h('span', { class: 'box', 'aria-hidden': 'true' }),
      h('span', { class: 'check-text' }, text)
    );
  }

  const CTA_ITEMS = [['read', 'Read about'], ['pray', 'Pray about'], ['share', 'Share about']];

  const renderers = {
    row(f, d) {
      return h('div', { class: 'row' }, f.fields.map((c) => renderField(c, d)));
    },

    col(f, d) {
      return h('div', { class: 'col' }, f.fields.map((c) => renderField(c, d)));
    },

    line(f, d) {
      return h('section', { class: 'field' },
        fieldLabel(f),
        h('input', {
          type: 'text', class: 'line-input', 'aria-label': f.label, value: d[f.key] || '',
          placeholder: f.placeholder || null,
          oninput: (e) => {
            d[f.key] = e.target.value;
            changed();
            if (f.rerenderTitle && current) {
              const t = document.getElementById('page-title');
              const page = SCHEMAS[current.note.type].pages[current.page];
              if (t) t.textContent = pageTitle(page, current.note.data);
            }
          },
        })
      );
    },

    choice(f, d) {
      if (!f.options.some(([k]) => k === d[f.key])) d[f.key] = f.options[0][0];
      return h('section', { class: 'field' },
        fieldLabel(f),
        h('div', { class: 'segmented choice', role: 'radiogroup', 'aria-label': f.label },
          f.options.map(([k, label]) => h('button', {
            type: 'button',
            role: 'radio',
            'aria-checked': String(d[f.key] === k),
            'aria-selected': String(d[f.key] === k),
            onclick: () => {
              if (d[f.key] === k) return;
              d[f.key] = k;
              changed();
              renderPage();
            },
          }, label))
        )
      );
    },

    lines(f, d) {
      return h('section', { class: 'field' },
        fieldLabel(f),
        linedTextarea(d[f.key], f.rows || 3, f.label, (v) => { d[f.key] = v; changed(); })
      );
    },

    checks(f, d) {
      const opts = typeof f.options === 'function' ? f.options(d) : f.options;
      const val = d[f.key] || (d[f.key] = { selected: [], other: '' });
      val.selected = (val.selected || []).filter((s) => opts.includes(s));

      const items = opts.map((o) => checkItem(o, val.selected.includes(o), (on) => {
        val.selected = on ? [...val.selected.filter((s) => s !== o), o] : val.selected.filter((s) => s !== o);
        changed();
        if (f.rerender) renderPage();
      }));

      if (f.other) {
        const box = h('input', { type: 'checkbox', checked: !!(val.other && val.other.trim()), tabindex: '-1', 'aria-hidden': 'true' });
        const text = h('input', {
          type: 'text', class: 'other-input', placeholder: 'Other', 'aria-label': `${f.label}: other`, value: val.other || '',
          oninput: (e) => { val.other = e.target.value; box.checked = !!val.other.trim(); changed(); },
        });
        box.addEventListener('change', () => { if (!box.checked) { val.other = ''; text.value = ''; changed(); } else text.focus(); });
        items.push(h('label', { class: 'check other' }, box, h('span', { class: 'box', 'aria-hidden': 'true' }), text));
      }

      return h('section', { class: 'field' },
        fieldLabel(f),
        h('div', { class: 'checks' }, items),
        f.detail && h('input', {
          type: 'text', class: 'line-input detail', placeholder: f.detail.placeholder, 'aria-label': f.detail.placeholder,
          value: d[f.detail.key] || '',
          oninput: (e) => { d[f.detail.key] = e.target.value; changed(); },
        })
      );
    },

    speakers(f, d) {
      const list = d[f.key] || (d[f.key] = []);
      if (!list.length) list.push({ name: '', topic: '', notes: '' });
      const wrap = h('div', { class: 'speakers' });

      function draw(focusLast) {
        wrap.replaceChildren(...list.map((s, i) => {
          const name = h('input', {
            type: 'text', class: 'line-input name', placeholder: 'Name', 'aria-label': `Speaker ${i + 1} name`, value: s.name,
            oninput: (e) => { s.name = e.target.value; changed(); },
          });
          return h('div', { class: 'speaker' },
            h('div', { class: 'speaker-top' },
              h('span', { class: 'speaker-num', 'aria-hidden': 'true' }, i + 1),
              h('div', { class: 'speaker-fields' },
                name,
                h('input', {
                  type: 'text', class: 'line-input topic', placeholder: 'Topic', 'aria-label': `Speaker ${i + 1} topic`, value: s.topic,
                  oninput: (e) => { s.topic = e.target.value; changed(); },
                })
              ),
              h('button', {
                type: 'button', class: 'icon-btn remove', 'aria-label': `Remove speaker ${i + 1}`,
                onclick: (e) => {
                  const remove = () => {
                    list.splice(i, 1);
                    if (!list.length) list.push({ name: '', topic: '', notes: '' });
                    draw();
                    changed();
                  };
                  if (hasContent(s)) armed(e.currentTarget, 'Remove?', remove);
                  else remove();
                },
              }, '×')
            ),
            f.notes && linedTextarea(s.notes, 3, `Speaker ${i + 1} notes`, (v) => { s.notes = v; changed(); }, 'Notes on this talk')
          );
        }));
        wrap.querySelectorAll('textarea').forEach(autoGrow);
        if (focusLast) wrap.querySelector('.speaker:last-child .name').focus();
      }
      draw();
      requestAnimationFrame(() => wrap.querySelectorAll('textarea').forEach(autoGrow));

      return h('section', { class: 'field' },
        fieldLabel(f, f.toggle && checkItem(f.toggle.label, !!d[f.toggle.key], (on) => { d[f.toggle.key] = on; changed(); })),
        wrap,
        h('button', {
          type: 'button', class: 'add-btn',
          onclick: () => { list.push({ name: '', topic: '', notes: '' }); draw(true); changed(); },
        }, '+ Add speaker')
      );
    },

    blocks(f, d) {
      const labels = blockLabels(f, d, false);
      const titles = blockLabels(f, d, true);
      const list = d[f.key] || (d[f.key] = []);
      while (list.length < labels.length) list.push({});
      const idx = Math.min(current.block || 0, labels.length - 1);
      const tabs = h('div', {
        class: `segmented block-tabs ${f.tabClass || ''}`, role: 'tablist', 'aria-label': f.ariaLabel || 'Blocks',
      },
        labels.map((label, i) => h('button', {
          type: 'button', role: 'tab', 'aria-selected': String(i === idx), 'aria-label': titles[i],
          onclick: () => {
            if (i === idx) return;
            current.block = blockByNote[current.note.id] = i;
            renderPage();
          },
        },
          label.includes('\n')
            ? label.split('\n').map((part, j) => h('span', { class: j ? 'tab-bottom' : 'tab-top' }, part))
            : label,
          hasContent(list[i]) && h('span', { class: 'filled-dot', title: 'Has notes' })
        ))
      );
      return h('section', { class: 'blocks' },
        tabs,
        h('div', { class: 'block-body' },
          h('h3', { class: 'display block-title' }, titles[idx]),
          f.fields.map((c) => renderField(c, list[idx]))
        )
      );
    },

    hearHim(f, d) {
      const dots = h('div', { class: 'dots', role: 'group', 'aria-label': f.label });
      const count = h('span', { class: 'count', 'aria-live': 'polite' });
      function draw() {
        const v = d[f.key] || 0;
        const n = Math.max(24, Math.ceil((v + 4) / 12) * 12);
        dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('button', {
          type: 'button',
          class: 'dot' + (i < v ? ' on' : ''),
          'aria-label': `Mark ${i + 1}`,
          'aria-pressed': String(i < v),
          onclick: () => { d[f.key] = v === i + 1 ? i : i + 1; changed(); draw(); },
        })));
        count.textContent = v ? `${v}` : '';
      }
      draw();
      return h('section', { class: 'field band hear-him' },
        h('div', { class: 'field-head' }, h('h3', { class: 'label' }, f.label), count),
        h('p', { class: 'hint' }, 'Tap a circle each time you hear Him.'),
        dots
      );
    },

    cta(f, d) {
      const val = d[f.key] || (d[f.key] = {});
      return h('section', { class: 'field band cta' },
        fieldLabel(f),
        CTA_ITEMS.map(([k, label]) => {
          const item = val[k] || (val[k] = { on: false, text: '' });
          const check = checkItem(label, item.on, (on) => { item.on = on; changed(); });
          const text = h('input', {
            type: 'text', class: 'line-input', placeholder: 'What?', 'aria-label': `${label} what`, value: item.text,
            oninput: (e) => {
              item.text = e.target.value;
              if (item.text.trim() && !item.on) { item.on = true; check.querySelector('input').checked = true; }
              changed();
            },
          });
          return h('div', { class: 'cta-item' }, check, text);
        })
      );
    },
  };

  function renderField(f, d) {
    if (f.show && !f.show(d)) return null;
    return renderers[f.type](f, d);
  }

  function renderPage() {
    if (!current) return;
    const { note } = current;
    const schema = SCHEMAS[note.type];
    const page = schema.pages[current.page];
    const host = document.getElementById('page');
    const y = window.scrollY;
    host.replaceChildren(
      h('h2', { class: 'display page-title', id: 'page-title' }, pageTitle(page, note.data)),
      ...page.fields.map((f) => renderField(f, note.data)).filter(Boolean)
    );
    host.querySelectorAll('textarea').forEach(autoGrow);
    window.scrollTo(0, y);
  }

  function shareNote() {
    flush();
    const text = noteToText(current.note);
    const title = describe(current.note).kicker;
    if (native()) { native().shareText(title, text); return; }
    const embedded = window.self !== window.top;
    if (navigator.share && !embedded) {
      navigator.share({ title, text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast('Copied to clipboard. Paste it anywhere.'),
        () => toast('Could not copy on this device.')
      );
    } else {
      toast('Could not copy on this device.');
    }
  }

  function deleteNote(e) {
    armed(e.currentTarget, 'Tap again to delete', reallyDelete);
  }

  function reallyDelete() {
    const id = current.note.id;
    clearTimeout(current.timer);
    current = null;
    Store.remove(id);
    location.hash = '#home';
  }

  function renderEditor(id) {
    if (current && current.note.id !== id) leaveEditor();
    const note = Store.get(id);
    if (!note || !SCHEMAS[note.type]) { location.replace('#home'); return; }
    const schema = SCHEMAS[note.type];
    if (!(id in blockByNote)) blockByNote[id] = schema.defaultBlock ? schema.defaultBlock(note.data) : 0;
    current = { note, timer: null, page: Math.min(pageByNote[id] || 0, schema.pages.length - 1), block: blockByNote[id] };
    document.title = `${schema.label} · Latter Day Notebook`;
    const d = note.data;

    const W = schema.when || { date: 'Date', time: true, location: true };
    const when = h('div', { class: 'when band' },
      h('label', { class: 'when-item' }, h('span', { class: 'label' }, W.date),
        h('input', {
          type: 'date', value: d.date || '',
          oninput: (e) => {
            d.date = e.target.value;
            changed();
            if (!W.time) renderPage(); // day labels follow the week's date
          },
        })),
      W.time && h('label', { class: 'when-item' }, h('span', { class: 'label' }, 'Time'),
        h('input', { type: 'time', value: d.time || '', oninput: (e) => { d.time = e.target.value; changed(); } })),
      W.location && h('label', { class: 'when-item where' }, h('span', { class: 'label' }, 'Location'),
        h('input', {
          type: 'text', placeholder: note.type === 'meeting' ? 'Stake center, broadcast…' : 'Ward / building', value: d.location || '',
          oninput: (e) => { d.location = e.target.value; changed(); },
        }))
    );

    let tabs = null;
    if (schema.pages.length > 1) {
      tabs = h('div', { class: 'segmented page-tabs', role: 'tablist' },
        schema.pages.map((p, i) => h('button', {
          type: 'button', role: 'tab', 'aria-selected': String(i === current.page),
          onclick: (e) => {
            current.page = pageByNote[id] = i;
            tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
            renderPage();
            window.scrollTo(0, 0);
          },
        }, p.short || pageTitle(p, d)))
      );
    }

    app.replaceChildren(...[
      h('header', { class: 'editor-bar' },
        h('a', { href: '#home', class: 'back' }, '‹ Notes'),
        h('span', { id: 'save-status', class: 'status' }, ''),
        h('button', { type: 'button', class: 'bar-btn', onclick: shareNote }, 'Share')
      ),
      tabs && h('div', { class: 'tabs-wrap' }, tabs),
      h('div', { class: 'editor' },
        when,
        h('div', { id: 'page', class: 'page' }),
        h('div', { class: 'editor-foot' },
          h('button', { type: 'button', class: 'danger-btn', onclick: deleteNote }, 'Delete note')
        )
      ),
    ].filter(Boolean));
    renderPage();
    window.scrollTo(0, 0);
  }

  /* ---------- boot ---------- */

  applyTheme(getTheme());
  // Follow the phone switching between light and dark while "System" is chosen.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (getTheme() === 'system') applyTheme('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
