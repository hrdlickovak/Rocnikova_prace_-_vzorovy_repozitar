// Obecná webová aplikace nad SQLite databází (sql.js). Nic tu nemusíte měnit:
// tabulky, sloupce a cizí klíče si přečte přímo z vašich SQL souborů.
(function () {
  'use strict';

  const SOUBORY = ['sql/01_schema.sql', 'sql/02_data.sql', 'sql/03_dotazy.sql'];

  let SQL, db;
  let sqlTexty = null;                     // [schema, data, dotazy]
  let mdTexty = {};                        // { README: '...', AI: '...' } zobrazí se jako záložky
  const MD_SOUBORY = [['README', 'README.md'], ['AI', 'AI.md']];
  let slozka = null;                       // vybraná složka projektu (při otevření dvojklikem)
  const stav = { zalozka: null, uprava: null, sql: '', vysledek: null, povolZapis: false, smazat: null, resetuj: false, varovani: [], tab: {}, hash: '', zUlozeni: null, nazev: 'Databáze', uloziste: true };

  // ---------- pomocné ----------
  function h(tag, atributy, ...deti) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(atributy || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const d of deti.flat()) {
      if (d == null || d === false) continue;
      e.append(d.nodeType ? d : document.createTextNode(String(d)));
    }
    return e;
  }
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const $ = (id) => document.getElementById(id);

  function zprava(text, druh) {
    const z = $('zprava'); z.replaceChildren();
    if (text) z.append(h('span', { class: druh || 'ok' }, text));
  }
  function chyba(e) {
    const m = String(e && e.message || e);
    let rada = '';
    if (/FOREIGN KEY/i.test(m)) rada = 'Záznam je propojený s jinou tabulkou (cizí klíč). Nejdřív uprav nebo smaž související záznamy.';
    else if (/UNIQUE/i.test(m)) rada = 'Tahle hodnota nebo kombinace už v databázi je a nesmí se opakovat (UNIQUE).';
    else if (/NOT NULL/i.test(m)) rada = 'Povinné pole zůstalo prázdné.';
    else if (/CHECK/i.test(m)) rada = 'Hodnota nesplňuje pravidlo (CHECK) ze schématu.';
    zprava((rada ? rada + ' ' : '') + '(' + m + ')', 'chyba');
  }

  // ---------- uložení do prohlížeče (jako skutečná aplikace: data přežijí obnovení stránky) ----------
  const KLIC = 'db:' + location.pathname;  // každý projekt (složka nebo adresa) má vlastní úložiště
  function hash(t) { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); }
  function naB64(u8) { let r = ''; for (let i = 0; i < u8.length; i += 0x8000) r += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(r); }
  function zB64(b) { const r = atob(b), u = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u; }
  function uloz() {
    try {
      const data = db.export();              // export() zavře spojení, proto znovu zapínáme cizí klíče
      db.run('PRAGMA foreign_keys = ON');
      localStorage.setItem(KLIC, JSON.stringify({ h: stav.hash, t: Date.now(), n: stav.nazev, m: mdTexty, d: naB64(data) }));
      stav.uloziste = true;
    } catch (e) { stav.uloziste = false; zprava('Změny se nepodařilo uložit v prohlížeči (soukromé okno nebo plné úložiště). Platí jen do obnovení stránky.', 'chyba'); }
  }
  function nactiUlozenou() {
    try {
      const o = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (!o) return null;
      const x = new SQL.Database(zB64(o.d)); x.run('PRAGMA foreign_keys = ON');
      x.exec('SELECT 1 FROM sqlite_master');
      return { db: x, h: o.h, t: o.t, n: String(o.n || '').slice(0, 60), m: o.m && typeof o.m === 'object' ? o.m : {} };
    } catch (e) { return null; }
  }

  // ---------- načtení SQL souborů ----------
  // 1) přes http (web, Live Server): sql/*.sql se načtou samy
  // 2) při otevření dvojklikem prohlížeč čtení zakáže: zeptáme se na složku projektu (Chrome, Edge)
  //    nebo na soubory (Firefox)
  async function zHttp() {
    if (location.protocol === 'file:') return null;
    try {
      const r = await Promise.all(SOUBORY.map(async (f) => {
        const res = await fetch(f, { cache: 'no-store' });
        if (!res.ok) return null;
        const t = await res.text();
        if (t.length > 1000000) return null;
        return /^\s*<(!doctype|html)/i.test(t) ? null : t;
      }));
      if (r[0] == null) return null;
      mdTexty = {};
      for (const [id, f] of MD_SOUBORY) {
        try { const res = await fetch(f, { cache: 'no-store' }); const t = res.ok ? await res.text() : ''; if (t && t.length < 200000 && !/^\s*<(!doctype|html)/i.test(t)) mdTexty[id] = t; } catch (e) { /* nevadí */ }
      }
      return [r[0], r[1] || '', r[2] || ''];
    } catch (e) { return null; }
  }
  async function zeSlozky(root) {
    let dir = root; mdTexty = {};
    try { dir = await root.getDirectoryHandle('sql'); } catch (e) { /* vybrána rovnou složka sql */ }
    if (dir !== root) for (const [id, f] of MD_SOUBORY) {
      try { const fl = await (await root.getFileHandle(f)).getFile(); if (fl.size < 200000) mdTexty[id] = await fl.text(); } catch (e) { /* nevadí */ }
    }
    const mapa = {};
    for await (const [jmeno, uchyt] of dir.entries()) {
      if (uchyt.kind !== 'file' || !/\.sql$/i.test(jmeno)) continue;
      if ((await uchyt.getFile()).size > 1000000) continue;
      const n = jmeno.toLowerCase();
      const k = /^01|schema|struktur/.test(n) ? 0 : /^02|data/.test(n) ? 1 : /^03|dotaz|quer/.test(n) ? 2 : -1;
      if (k >= 0 && mapa[k] == null) mapa[k] = await (await uchyt.getFile()).text();
    }
    if (mapa[0] == null) throw new Error('Ve složce jsem nenašel sql/01_schema.sql.');
    return [mapa[0], mapa[1] || '', mapa[2] || ''];
  }
  function zeptejSe() {
    return new Promise((hotovo) => {
      const chybaBox = h('p', { class: 'tlum', id: 'vyber-chyba' });
      const karta = h('div', { class: 'karta' },
        h('h2', {}, 'Kde jsou SQL soubory?'),
        h('p', {}, 'Stránku jsi otevřel(a) přímo ze souboru, a to prohlížeč nedovolí číst složku sql sám. Stačí jedno kliknutí:'));
      if (window.showDirectoryPicker) {
        karta.append(h('p', {}, h('button', { class: 'tl hlavni', onclick: async () => {
          try {
            slozka = await window.showDirectoryPicker({ mode: 'read' });
            hotovo(await zeSlozky(slozka));
          } catch (e) { slozka = null; if (e.name !== 'AbortError') chybaBox.textContent = e.message; }
        } }, 'Vybrat složku projektu')),
          h('p', { class: 'tlum' }, 'Vyber složku, kde je soubor index.html (najde si v ní podsložku sql).'));
      } else {
        const vstup = h('input', { type: 'file', multiple: true, accept: '.sql' });
        vstup.addEventListener('change', async () => {
          const mapa = {};
          for (const f of vstup.files) { const k = f.name.slice(0, 2); if (['01', '02', '03'].includes(k)) mapa[k] = await f.text(); }
          if (!mapa['01']) { chybaBox.textContent = 'Chybí 01_schema.sql.'; return; }
          hotovo([mapa['01'], mapa['02'] || '', mapa['03'] || '']);
        });
        karta.append(h('p', {}, 'Tenhle prohlížeč neumí vybrat celou složku. Vyber najednou soubory 01_schema.sql, 02_data.sql, 03_dotazy.sql ze složky sql:'), vstup);
      }
      karta.append(chybaBox);
      $('obsah').replaceChildren(karta);
    });
  }
  async function nactiTexty() {
    if (slozka) { try { return await zeSlozky(slozka); } catch (e) { slozka = null; } }
    return (await zHttp()) || (await zeptejSe());
  }

  // ---------- vytvoření databáze ----------
  function spustSkript(d, text, jmeno, varovani) {   // chybný příkaz neshodí zbytek, jen se ohlásí
    try {
      for (const st of d.iterateStatements(text)) {
        try { st.step(); } catch (e) { varovani.push('Chyba v ' + jmeno + ': ' + e.message + ' (příkaz: ' + String(st.getSQL()).trim().replace(/\s+/g, ' ').slice(0, 80) + ')'); } finally { st.free(); }
      }
    } catch (e) { varovani.push('Chyba v ' + jmeno + ': ' + e.message + ' (zbytek souboru se přeskočil)'); }
  }
  function postav(texty, varovani) {
    const nova = new SQL.Database(); const v = varovani || [];
    nova.exec('PRAGMA foreign_keys = ON');
    spustSkript(nova, texty[0], '01_schema.sql', v);   // CREATE TABLE IF NOT EXISTS ...
    spustSkript(nova, texty[1], '02_data.sql', v);     // INSERT OR IGNORE ...
    return nova;
  }

  // ---------- čtení schématu přímo z databáze ----------
  function tabulky() {
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid");
    return r.length ? r[0].values.map((v) => v[0]) : [];
  }
  function sloupce(t) {
    const cols = db.exec('PRAGMA table_info(' + q(t) + ')')[0].values.map((v) => ({
      name: v[1], type: String(v[2] || '').toUpperCase(), notnull: !!v[3], dflt: v[4], pk: v[5] > 0
    }));
    const fk = db.exec('PRAGMA foreign_key_list(' + q(t) + ')');
    if (fk.length) fk[0].values.forEach((v) => {
      const c = cols.find((x) => x.name === v[3]);
      if (c) c.fk = { tabulka: v[2], sloupec: v[4] };
    });
    return cols;
  }
  function popisekSloupec(t) {              // první textový sloupec, podle kterého se záznam pozná
    const cols = sloupce(t);
    const txt = cols.find((c) => !c.pk && !c.fk && !/INT|REAL|NUM/.test(c.type));
    return (txt || cols.find((c) => !c.pk) || cols[0]).name;
  }
  function moznosti(fk) {                   // [{id, popisek}] pro rozbalovátko cizího klíče
    const pkCol = fk.sloupec || sloupce(fk.tabulka).find((c) => c.pk).name;
    const pop = popisekSloupec(fk.tabulka);
    let sql = 'SELECT ' + q(pkCol) + ', ' + q(pop) + ' FROM ' + q(fk.tabulka) + ' ORDER BY ' + q(pop);
    // Řádek, který sám odkazuje jinam (výtisk -> kniha), dostane popisek "Kniha (výtisk)", ať se rozliší.
    const rc = sloupce(fk.tabulka).find((c) => c.fk && c.fk.tabulka !== fk.tabulka);
    const rodic = rc && { tabulka: rc.fk.tabulka, sloupec: rc.fk.sloupec, od: rc.name };
    if (rodic && pop !== pkCol) {
      const pp = popisekSloupec(rodic.tabulka);
      const rpk = rodic.sloupec || sloupce(rodic.tabulka).find((c) => c.pk).name;
      sql = 'SELECT t.' + q(pkCol) + ', COALESCE(p.' + q(pp) + ", '?') || ' (' || t." + q(pop) + " || ')' AS x FROM " + q(fk.tabulka) +
        ' t LEFT JOIN ' + q(rodic.tabulka) + ' p ON p.' + q(rpk) + ' = t.' + q(rodic.od) + ' ORDER BY x';
    }
    const r = db.exec(sql);
    return r.length ? r[0].values.map((v) => ({ id: v[0], popisek: v[1] })) : [];
  }
  function jeCislo(c) { return /INT|REAL|NUM|DOUB|FLOA/.test(c.type); }
  function jeDatum(c) { return /datum|date/i.test(c.name); }

  // ---------- vykreslení ----------
  function vykresli() {
    $('nadpis').textContent = stav.nazev;
    document.title = stav.nazev;
    const t = tabulky();
    if (!stav.zalozka || (!['__struktura', '__sql', '__doc'].includes(stav.zalozka) && !t.includes(stav.zalozka))) stav.zalozka = '__struktura';

    const polozky = [['__struktura', 'Přehled'], ...t.map((n) => [n, n]), ['__sql', 'SQL'], ['__doc', 'Dokumentace']];
    $('zalozky').replaceChildren(...polozky.map(([id, text]) => zalozka(id, text)));
    $('prejit').replaceChildren(...polozky.map(([id, text]) => h('option', { value: id, selected: stav.zalozka === id }, text)));
    $('prejit').onchange = (e) => { stav.zalozka = e.target.value; stav.uprava = null; stav.smazat = null; zprava(''); vykresli(); };

    const okno = stav.zalozka === '__doc' ? dokumentaceOkno() : stav.zalozka === '__sql' ? sqlOkno() : stav.zalozka === '__struktura' ? strukturaOkno() : tabulkaOkno(stav.zalozka);
    const banner = stav.zUlozeni ? [h('p', { class: 'info' }, 'Databáze je uložená v tomto prohlížeči (změněna ' + new Date(stav.zUlozeni).toLocaleString('cs-CZ') + '). Po úpravě SQL souborů dole klikni na „Načíst znovu ze SQL souborů“.')] : [];
    $('obsah').replaceChildren(...banner, ...stav.varovani.map((v) => h('div', { class: 'karta varovani' }, v)), okno);
  }
  function zalozka(id, text) {
    return h('button', {
      role: 'tab', 'aria-selected': String(stav.zalozka === id),
      onclick: () => { stav.zalozka = id; stav.uprava = null; stav.smazat = null; zprava(''); vykresli(); }
    }, text);
  }

  const MAX_ZOBRAZ = 200;
  const bezDiakritiky = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function tabulkaOkno(t) {
    const cols = sloupce(t);
    const mapy = {};                         // id -> popisek pro cizí klíče
    cols.forEach((c) => { if (c.fk) { mapy[c.name] = new Map(moznosti(c.fk).map((m) => [m.id, m.popisek])); } });
    // propojení "ven": kolik záznamů z jiných tabulek odkazuje na každý řádek (mapa vztahů v datech)
    const pouziti = vztahy(tabulky()).filter((v) => v.rodic === t && v.dite !== t).map((v) => {
      const r = db.exec('SELECT ' + q(v.sloupec) + ', COUNT(*) FROM ' + q(v.dite) + ' GROUP BY ' + q(v.sloupec));
      return { dite: v.dite, idx: cols.findIndex((c) => c.name === v.ref), mapa: new Map(r.length ? r[0].values : []) };
    });
    const r = db.exec('SELECT rowid, * FROM ' + q(t) + ' ORDER BY rowid');
    const radky = (r.length ? r[0].values : []).map((rad) => {
      const hodn = rad.slice(1);
      const zobraz = cols.map((c, i) => hodn[i] === null ? '' : (c.fk && mapy[c.name].has(hodn[i])) ? mapy[c.name].get(hodn[i]) : String(hodn[i]));
      return { rid: rad[0], hodn, zobraz, pouz: pouziti.map((p) => p.dite + ': ' + (p.mapa.get(hodn[p.idx]) || 0)) };
    });
    const st = (stav.tab[t] = stav.tab[t] || { hledat: '', razeni: -1, smer: 1 });

    const tbody = h('tbody', {}), nadpis = h('h2', {}), pozn = h('p', { class: 'tlum' });
    const hlavicka = h('tr', {});
    function obnov() {
      const hl = bezDiakritiky(st.hledat.trim());
      let v = radky.filter((x) => !hl || x.zobraz.some((z) => bezDiakritiky(z).includes(hl)));
      if (st.razeni >= 0) v = v.slice().sort((x, y) => {
        const a1 = x.hodn[st.razeni], b1 = y.hodn[st.razeni];
        if (a1 === null || b1 === null) return (a1 === null ? 1 : 0) - (b1 === null ? 1 : 0);
        const cmp = (typeof a1 === 'number' && typeof b1 === 'number' && !cols[st.razeni].fk) ? a1 - b1 : x.zobraz[st.razeni].localeCompare(y.zobraz[st.razeni], 'cs');
        return cmp * st.smer;
      });
      nadpis.textContent = t + ' (' + (v.length === radky.length ? radky.length : v.length + ' z ' + radky.length) + ')';
      pozn.textContent = v.length > MAX_ZOBRAZ ? 'Zobrazeno prvních ' + MAX_ZOBRAZ + ' řádků. Zúži hledání.' : (v.length ? '' : (radky.length ? 'Nic nevyhovuje hledání.' : 'Tabulka je prázdná.'));
      hlavicka.replaceChildren(...cols.map((c, i) => h('th', { 'aria-sort': st.razeni === i ? (st.smer > 0 ? 'ascending' : 'descending') : 'none' },
        h('button', { class: 'razeni', type: 'button', onclick: () => { st.smer = st.razeni === i ? -st.smer : 1; st.razeni = i; obnov(); } },
          c.name + (st.razeni === i ? (st.smer > 0 ? ' ▲' : ' ▼') : '')))),
        ...(pouziti.length ? [h('th', {}, 'Používá se v')] : []), h('th', {}));
      tbody.replaceChildren(...v.slice(0, MAX_ZOBRAZ).map((x) => h('tr', {},
        cols.map((c, i) => {
          const hodnota = x.hodn[i];
          if (hodnota === null) return h('td', { class: 'prazdne', 'data-label': c.name }, '–');
          if (jeDatum(c)) return h('td', { class: 'datum', 'data-label': c.name }, hodnota);
          if (c.fk && mapy[c.name].has(hodnota)) return h('td', { 'data-label': c.name }, mapy[c.name].get(hodnota));
          return h('td', { 'data-label': c.name }, hodnota);
        }),
        pouziti.length ? h('td', { class: 'poc', 'data-label': 'Používá se v' }, x.pouz.join(', ')) : null,
        h('td', { class: 'akce' },
          h('button', { class: 'tl', onclick: () => { stav.uprava = { t, rid: x.rid, rad: x.hodn }; zprava(''); vykresli(); window.scrollTo(0, document.body.scrollHeight); } }, 'Upravit'), ' ',
          h('button', { class: 'tl nebezpecne', onclick: () => smaz(t, x.rid) },
            stav.smazat && stav.smazat.t === t && stav.smazat.rid === x.rid ? 'Opravdu smazat?' : 'Smazat')))));
    }
    const hledani = h('input', { type: 'search', class: 'hledani', placeholder: 'Hledat v tabulce…', maxlength: 100, autocomplete: 'off', 'aria-label': 'Hledat v tabulce', value: st.hledat });
    hledani.addEventListener('input', () => { st.hledat = hledani.value.replace(RE_ZNAKY, ''); obnov(); });
    obnov();
    return h('div', {},
      h('div', { class: 'karta' }, nadpis, radky.length > 5 ? hledani : null,
        radky.length ? h('table', { class: 'responz' }, h('thead', {}, hlavicka), tbody) : null, pozn),
      formular(t, cols));
  }

  // ---------- zobrazení README.md a AI.md (malý bezpečný převod Markdownu, jen přes DOM, žádné innerHTML) ----------
  const bezpecnaCesta = (u) => /^https?:\/\/[^\s]+$/i.test(u) || (/^[\w.\/-]+$/.test(u) && !u.startsWith('/') && !u.includes('..'));
  function mdInline(text) {
    return text.split(/(!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`)/).filter((x) => x !== '').map((p) => {
      let m;
      if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(p))) return bezpecnaCesta(m[2]) && !/^https?:/i.test(m[2]) ? h('img', { src: m[2], alt: m[1] }) : m[1];
      if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p))) return bezpecnaCesta(m[2]) ? h('a', { href: m[2], target: '_blank', rel: 'noopener noreferrer' }, m[1]) : m[1];
      if ((m = /^\*\*([^*]+)\*\*$/.exec(p))) return h('b', {}, m[1]);
      if ((m = /^`([^`]+)`$/.exec(p))) return h('code', {}, m[1]);
      return p;
    });
  }
  function mdOkno(text) {
    const radky = String(text || '').replace(/\r/g, '').split('\n');
    const kus = []; let i = 0;
    const bunky = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    while (i < radky.length) {
      const r = radky[i];
      let m;
      if (/^```/.test(r)) { const kod = []; i++; while (i < radky.length && !/^```/.test(radky[i])) kod.push(radky[i++]); i++; kus.push(h('pre', { class: 'sqlkod' }, kod.join('\n'))); }
      else if ((m = /^(#{1,3})\s+(.*)$/.exec(r))) { kus.push(h('h' + (m[1].length + 1), {}, mdInline(m[2]))); i++; }
      else if (/^\s*\|/.test(r) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(radky[i + 1] || '')) {
        const hl = bunky(r); i += 2; const telo = [];
        while (i < radky.length && /^\s*\|/.test(radky[i])) telo.push(bunky(radky[i++]));
        kus.push(h('table', { class: 'responz' }, h('thead', {}, h('tr', {}, hl.map((x) => h('th', {}, mdInline(x))))),
          h('tbody', {}, telo.map((t) => h('tr', {}, t.map((x, k) => h('td', { 'data-label': hl[k] || '' }, mdInline(x))))))));
      }
      else if (/^\s*([-*]|\d+\.)\s+/.test(r)) {
        const cisl = /^\s*\d+\./.test(r), pol = [];
        while (i < radky.length && /^\s*([-*]|\d+\.)\s+/.test(radky[i])) pol.push(h('li', {}, mdInline(radky[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))));
        kus.push(h(cisl ? 'ol' : 'ul', {}, pol));
      }
      else if (/^>\s?/.test(r)) { const t = []; while (i < radky.length && /^>\s?/.test(radky[i])) t.push(radky[i++].replace(/^>\s?/, '')); kus.push(h('blockquote', {}, mdInline(t.join(' ')))); }
      else if (/^---+\s*$/.test(r)) { kus.push(h('hr', {})); i++; }
      else if (r.trim() === '') i++;
      else { const t = []; while (i < radky.length && radky[i].trim() !== '' && !/^(#|```|>|\s*\||\s*([-*]|\d+\.)\s)/.test(radky[i])) t.push(radky[i++]); if (!t.length) { t.push(radky[i++]); } kus.push(h('p', {}, mdInline(t.join(' ')))); }
    }
    return h('div', { class: 'karta md' }, kus);
  }
  function dokumentaceOkno() {
    const texty = MD_SOUBORY.map(([id]) => mdTexty[id]).filter(Boolean);
    if (texty.length) return mdOkno(texty.join('\n\n---\n\n'));
    const hlaska = h('p', { class: 'tlum' });
    const nacti = async (soubory) => {
      const nove = {};
      for (const f of soubory) { const x = MD_SOUBORY.find(([, jm]) => jm.toLowerCase() === f.name.toLowerCase()); if (x && f.size < 200000) nove[x[0]] = await f.text(); }
      if (!Object.keys(nove).length) { hlaska.textContent = 'Nenašel jsem README.md ani AI.md. Vyber složku projektu (tam, kde je index.html).'; return; }
      mdTexty = nove; uloz(); vykresli();
    };
    const tlacitko = window.showDirectoryPicker
      ? h('button', { class: 'tl hlavni', onclick: async () => {
          try { const r = await window.showDirectoryPicker({ mode: 'read' }); const sb = []; for await (const [jm, u] of r.entries()) if (u.kind === 'file' && /^(README|AI)\.md$/i.test(jm)) sb.push(await u.getFile()); await nacti(sb); }
          catch (e) { if (e.name !== 'AbortError') hlaska.textContent = e.message; }
        } }, 'Vybrat složku projektu')
      : h('input', { type: 'file', multiple: true, accept: '.md', onchange: (e) => nacti([...e.target.files]) });
    return h('div', { class: 'karta' }, h('h2', {}, 'Dokumentace'),
      h('p', {}, 'README.md a AI.md se tu zobrazí, až je web najde. Při otevření dvojklikem je musíš vybrat ručně:'), tlacitko, hlaska);
  }

  // ---------- ochrana vstupu: 4 vrstvy ----------
  // 1. HTML:  maxlength, minlength, pattern, type, min, max, required (prohlížeč nepustí chybný formulář)
  // 2. CSS:   chybná pole jsou červená a tlačítko odeslání je zhasnuté, dokud je formulář chybný
  // 3. JS:    funkce over() všechno zkontroluje znovu, i kdyby někdo HTML atributy smazal v nástrojích prohlížeče
  // 4. SQL:   NOT NULL, CHECK, UNIQUE a cizí klíče ze schématu (to je „server“: poslední a nejpřísnější kontrola)
  // Do SQL nikdy nevkládáme text od uživatele. Hodnoty jdou vždy jako parametry (?), názvy tabulek jen ze schématu.
  const MAX_TEXT = 255;
  const RE_ZNAKY = /[\u0000-\u001F\u007F]/;
  const PATTERN_TEXT = '[^<>\\u0000-\\u001F\\u007F]*';

  function omezeni(c, tabSql) {
    const o = { typ: 'text', min: null, max: null, minLen: 0, maxLen: MAX_TEXT, pattern: PATTERN_TEXT };
    const nm = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (jeDatum(c)) { o.typ = 'datum'; o.min = '1900-01-01'; o.max = '2100-12-31'; o.maxLen = 10; o.pattern = null; return o; }
    if (jeCislo(c)) {
      o.typ = /REAL|DOUB|FLOA/.test(c.type) ? 'cislo' : 'cele'; o.min = -2147483647; o.max = 2147483647; o.pattern = null;
      let m = new RegExp(nm + '["`\\]]?\\s+BETWEEN\\s+(-?\\d+(?:\\.\\d+)?)\\s+AND\\s+(-?\\d+(?:\\.\\d+)?)', 'i').exec(tabSql || '');
      if (m) { o.min = Math.max(o.min, +m[1]); o.max = Math.min(o.max, +m[2]); }
      m = new RegExp(nm + '["`\\]]?\\s*>=\\s*(-?\\d+(?:\\.\\d+)?)', 'i').exec(tabSql || ''); if (m) o.min = Math.max(o.min, +m[1]);
      m = new RegExp(nm + '["`\\]]?\\s*<=\\s*(-?\\d+(?:\\.\\d+)?)', 'i').exec(tabSql || ''); if (m) o.max = Math.min(o.max, +m[1]);
      return o;
    }
    const v = /(?:VAR)?CHAR\s*\(\s*(\d+)\s*\)/.exec(c.type); if (v) { o.maxLen = Math.min(+v[1], 10000); o.limit = true; }
    const l = new RegExp('length\\s*\\(\\s*(?:trim\\s*\\(\\s*)?["`\\[]?' + nm + '["`\\]]?\\s*\\)?\\s*\\)\\s*(?:BETWEEN\\s+(\\d+)\\s+AND\\s+(\\d+)|<=\\s*(\\d+))', 'i').exec(tabSql || '');
    if (l) o.limit = true;
    if (l) { if (l[1] != null) { o.minLen = +l[1]; o.maxLen = Math.min(o.maxLen, +l[2]); } else o.maxLen = Math.min(o.maxLen, +l[3]); }
    if (c.notnull && c.dflt == null) o.minLen = Math.max(o.minLen, 1);
    if (/e-?mail/i.test(c.name)) { o.typ = 'email'; o.maxLen = Math.min(o.maxLen, 254); o.pattern = null; }
    else if (/telefon|phone|^tel(_|$)/i.test(c.name)) { o.typ = 'tel'; o.pattern = '\\+?[0-9 ]{9,15}'; o.maxLen = 16; }
    return o;
  }

  // JS vrstva: vrátí { hodnota } nebo { chyba }. Nic nevěří formuláři.
  function over(c, o, surovy, idFk) {
    const t = String(surovy == null ? '' : surovy).normalize('NFC');
    if (RE_ZNAKY.test(t)) return { chyba: 'obsahuje nepovolené (řídicí) znaky' };
    const x = t.trim();
    if (x === '') return c.notnull && c.dflt == null ? { chyba: 'je povinné' } : { hodnota: null, prazdne: true };
    if (c.fk) return idFk && idFk.has(x) ? { hodnota: Number(x) } : { chyba: 'neplatná volba' };
    if (x.length > o.maxLen) return { chyba: 'může mít nejvýš ' + o.maxLen + ' znaků (má ' + x.length + ')' };
    if (x.length < o.minLen) return { chyba: 'musí mít aspoň ' + o.minLen + ' znaků' };
    if (o.typ === 'cele' || o.typ === 'cislo') {
      const re = o.typ === 'cele' ? /^-?\d{1,10}$/ : /^-?\d{1,12}([.,]\d{1,6})?$/;
      if (!re.test(x)) return { chyba: o.typ === 'cele' ? 'musí být celé číslo' : 'musí být číslo' };
      const n = Number(x.replace(',', '.'));
      if (n < o.min || n > o.max) return { chyba: 'musí být mezi ' + o.min + ' a ' + o.max };
      return { hodnota: n };
    }
    if (o.typ === 'datum') {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(x + 'T00:00:00Z') : null;
      if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== x) return { chyba: 'není platné datum (RRRR-MM-DD)' };
      if (x < o.min || x > o.max) return { chyba: 'musí být mezi ' + o.min + ' a ' + o.max };
      return { hodnota: x };
    }
    if (/[<>]/.test(x)) return { chyba: 'nesmí obsahovat znaky < a >' };
    if (o.typ === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x)) return { chyba: 'není platný e-mail' };
    if (o.typ === 'tel' && !/^\+?[0-9 ]{9,15}$/.test(x)) return { chyba: 'není platné telefonní číslo' };
    return { hodnota: x };
  }

  function tabulkaSql(t) {
    const r = db.exec('SELECT sql FROM sqlite_master WHERE name = ?', [t]);
    return r.length ? String(r[0].values[0][0]) : '';
  }

  function formular(t, cols) {
    const u = stav.uprava && stav.uprava.t === t ? stav.uprava : null;
    const tsql = tabulkaSql(t);
    const policka = cols.map((c, i) => {
      const jePkAuto = c.pk && /^INTEGER$/.test(c.type);
      if (jePkAuto && !u) return null;       // nové id přidělí databáze
      const hodnota = u ? u.rad[i] : null;
      const povinne = c.notnull && c.dflt == null && !c.pk;
      const spolecne = { name: c.name, id: 'f_' + c.name, autocomplete: 'off' };
      if (u && c.pk) spolecne.readonly = true;
      let vstup, pocitadlo = null;
      if (c.fk) {
        vstup = h('select', { ...spolecne, required: povinne },
          h('option', { value: '' }, '– vyber –'),
          moznosti(c.fk).map((m) => h('option', { value: m.id, selected: u && String(m.id) === String(hodnota) }, m.popisek)));
      } else {
        const o = omezeni(c, tsql);
        const atr = { ...spolecne, required: povinne, value: hodnota == null ? '' : hodnota, placeholder: c.dflt != null ? 'výchozí: ' + c.dflt : ' ' };
        if (o.typ === 'datum') Object.assign(atr, { type: 'date', min: o.min, max: o.max });
        else if (o.typ === 'cele' || o.typ === 'cislo') Object.assign(atr, { type: 'number', min: o.min, max: o.max, step: o.typ === 'cele' ? '1' : 'any', inputmode: o.typ === 'cele' ? 'numeric' : 'decimal' });
        else {
          Object.assign(atr, { type: o.typ === 'email' ? 'email' : o.typ === 'tel' ? 'tel' : 'text', maxlength: o.maxLen, minlength: o.minLen || null, pattern: o.pattern, title: o.typ === 'tel' ? 'Telefon, 9 až 15 číslic' : 'Nepoužívej znaky < a >' });
          pocitadlo = h('small', { class: 'pocitadlo' }, (hodnota == null ? 0 : String(hodnota).length) + ' / ' + o.maxLen);
        }
        vstup = h('input', atr);
        if (pocitadlo) vstup.addEventListener('input', () => { pocitadlo.textContent = vstup.value.length + ' / ' + o.maxLen; });
      }
      return h('label', {}, h('span', { class: 'lh' }, h('span', {}, c.name + (povinne ? ' *' : '')), pocitadlo), vstup);
    }).filter(Boolean);

    return h('div', { class: 'karta' },
      h('h2', {}, u ? 'Upravit záznam v ' + t : 'Přidat záznam do ' + t),
      h('form', { class: 'mrizka', autocomplete: 'off', onsubmit: (e) => { e.preventDefault(); odeslat(t, cols, e.target, u, tsql); } },
        policka,
        h('div', { class: 'radek' },
          h('button', { class: 'tl hlavni', type: 'submit' }, u ? 'Uložit změny' : 'Přidat'),
          u && h('button', { class: 'tl', type: 'button', onclick: () => { stav.uprava = null; vykresli(); } }, 'Zrušit'))),
      h('p', { class: 'info' }, '* je povinné pole. Prázdné pole bez * dostane výchozí hodnotu.'));
  }

  function odeslat(t, cols, form, u, tsql) {
    if (!form.checkValidity()) { form.reportValidity(); return; }       // vrstva 1: HTML
    const f = new FormData(form), chyby = [], hodnoty = {};
    cols.forEach((c) => {                                                // vrstva 3: JS (jen sloupce ze schématu)
      if (c.pk) return;
      if (!f.has(c.name)) return;
      const idFk = c.fk ? new Set(moznosti(c.fk).map((m) => String(m.id))) : null;
      const r = over(c, omezeni(c, tsql), f.get(c.name), idFk);
      if (r.chyba) chyby.push(c.name + ' ' + r.chyba); else hodnoty[c.name] = r;
    });
    if (chyby.length) { zprava('Oprav prosím: ' + chyby.join('; ') + '.', 'chyba'); return; }
    ulozZaznam(t, cols, hodnoty, u);                                     // vrstva 4: SQL omezení rozhodne naposled
  }
  function ulozZaznam(t, cols, hodnoty, u) {
    try {
      if (u) {
        const nastav = cols.filter((c) => !c.pk && hodnoty[c.name]);
        db.run('UPDATE ' + q(t) + ' SET ' + nastav.map((c) => q(c.name) + ' = ?').join(', ') + ' WHERE rowid = ?',
          [...nastav.map((c) => hodnoty[c.name].hodnota), u.rid]);
        stav.uprava = null; zprava('Změny uloženy.');
      } else {
        const pouzit = cols.filter((c) => hodnoty[c.name] && !hodnoty[c.name].prazdne);
        if (pouzit.length) {
          db.run('INSERT INTO ' + q(t) + ' (' + pouzit.map((c) => q(c.name)).join(', ') + ') VALUES (' + pouzit.map(() => '?').join(', ') + ')',
            pouzit.map((c) => hodnoty[c.name].hodnota));
        } else db.run('INSERT INTO ' + q(t) + ' DEFAULT VALUES');
        zprava('Záznam přidán.');
      }
      uloz(); vykresli();
    } catch (e) { chyba(e); }
  }
  function smaz(t, rid) {
    if (!stav.smazat || stav.smazat.t !== t || stav.smazat.rid !== rid) { stav.smazat = { t, rid }; vykresli(); return; }
    try {
      db.run('DELETE FROM ' + q(t) + ' WHERE rowid = ?', [rid]);
      stav.smazat = null; zprava('Záznam smazán.'); uloz();
    } catch (e) { stav.smazat = null; chyba(e); }
    vykresli();
  }

  // ---------- okno SQL ----------
  function dotazyZeSouboru() {
    const text = (sqlTexty && sqlTexty[2]) || '';
    return text.split(/^-- (?=\d+\) )/m).slice(1).map((blok) => {
      const radky = blok.split('\n');
      return { nazev: radky[0].trim(), sql: radky.slice(1).join('\n').trim() };
    });
  }
  // Okno SQL je vývojářský nástroj. Aby nebylo dírou:
  //  - jen JEDEN příkaz (žádné „SELECT 1; DROP TABLE ...“)
  //  - výchozí režim je jen čtení: SELECT / WITH, databáze je při něm zamčená příkazem PRAGMA query_only
  //  - INSERT / UPDATE / DELETE jen po zaškrtnutí „Povolit zápis“
  //  - změna struktury (DROP, ALTER, CREATE, PRAGMA, ATTACH ...) je zakázaná vždy, patří do SQL souboru
  const SQL_CTENI = ['SELECT', 'WITH', 'VALUES', 'EXPLAIN'];
  const SQL_ZAPIS = ['INSERT', 'UPDATE', 'DELETE', 'REPLACE'];
  const MAX_SQL = 5000, MAX_RADKU = 500;
  function overSql(text) {
    if (text.length > MAX_SQL) return { chyba: 'SQL je moc dlouhé (nejvýš ' + MAX_SQL + ' znaků).' };
    if (RE_ZNAKY.test(text.replace(/[\t\n\r]/g, ''))) return { chyba: 'SQL obsahuje nepovolené znaky.' };
    const bez = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').trim();
    if (!bez) return { chyba: 'Napiš nějaký příkaz.' };
    let pocet = 0;
    try { for (const st of db.iterateStatements(text)) { pocet++; st.free(); } } catch (e) { return { chyba: e.message }; }
    if (pocet !== 1) return { chyba: 'Spusť vždy jen jeden příkaz (našel jsem ' + pocet + ').' };
    const slovo = (/^\s*([A-Za-z]+)/.exec(bez) || [])[1];
    const S = (slovo || '').toUpperCase();
    if (SQL_CTENI.includes(S)) return { druh: 'cteni' };
    if (SQL_ZAPIS.includes(S)) return { druh: 'zapis' };
    return { chyba: S + ' tady nejde. Změny struktury (CREATE, DROP, ALTER, PRAGMA …) patří do souboru 01_schema.sql.' };
  }
  function sqlOkno() {
    const dotazy = dotazyZeSouboru();
    const pole = h('textarea', { id: 'sqltext', spellcheck: 'false', maxlength: MAX_SQL }); pole.value = stav.sql;
    pole.addEventListener('input', () => { stav.sql = pole.value; });
    const vyber = h('select', { onchange: (e) => { const d = dotazy[e.target.value]; if (d) { stav.sql = d.sql; pole.value = d.sql; } } },
      h('option', { value: '' }, dotazy.length ? '– vyber ukázkový dotaz –' : '– dotazy ze souboru 03_dotazy.sql nejsou k dispozici –'),
      dotazy.map((d, i) => h('option', { value: i }, d.nazev)));
    const zapis = h('input', { type: 'checkbox', id: 'povolzapis' }); zapis.checked = !!stav.povolZapis;
    zapis.addEventListener('change', () => { stav.povolZapis = zapis.checked; });
    return h('div', {},
      h('div', { class: 'karta' }, h('h2', {}, 'Vlastní SQL'), vyber, pole,
        h('div', { class: 'radek' }, h('button', { class: 'tl hlavni', onclick: spust }, 'Spustit'),
          h('label', { class: 'radekl' }, zapis, ' Povolit zápis (INSERT, UPDATE, DELETE)')),
        h('p', { class: 'info' }, 'Spouští se jeden příkaz. Změny struktury tu nejdou. Kdyby se něco pokazilo, na Přehledu je „Načíst znovu“.')),
      stav.vysledek ? vysledekKarta(stav.vysledek) : null);
  }
  function spust() {
    const k = overSql(stav.sql);
    if (k.chyba) { stav.vysledek = null; zprava(k.chyba, 'chyba'); vykresli(); return; }
    if (k.druh === 'zapis' && !stav.povolZapis) { stav.vysledek = null; zprava('Tenhle příkaz mění data. Zaškrtni „Povolit zápis“.', 'chyba'); vykresli(); return; }
    try {
      db.run('PRAGMA query_only = ' + (k.druh === 'cteni' ? 'ON' : 'OFF'));      // čtení je zamčené i na úrovni databáze
      const res = db.exec(stav.sql);
      stav.vysledek = res.length ? res : [{ zmeneno: db.getRowsModified() }];
      zprava('Hotovo.');
      if (k.druh === 'zapis') uloz();
    } catch (e) { stav.vysledek = null; chyba(e); }
    finally { try { db.run('PRAGMA query_only = OFF'); } catch (e) { /* nevadí */ } }
    vykresli();
  }
  function vysledekKarta(res) {
    return h('div', {}, res.map((r) => h('div', { class: 'karta' },
      r.columns ? [
        h('p', { class: 'tlum' }, 'Řádků: ' + r.values.length + (r.values.length > MAX_RADKU ? ' (zobrazeno prvních ' + MAX_RADKU + ')' : '')),
        h('table', { class: 'responz' }, h('thead', {}, h('tr', {}, r.columns.map((c) => h('th', {}, c)))),
          h('tbody', {}, r.values.slice(0, MAX_RADKU).map((v) => h('tr', {}, v.map((x, i) => x === null ? h('td', { class: 'prazdne', 'data-label': r.columns[i] }, '–') : h('td', { 'data-label': r.columns[i] }, String(x).slice(0, 300)))))))
      ] : h('p', {}, 'Příkaz proběhl. Změněno řádků: ' + r.zmeneno))));
  }


  // ---------- struktura databáze ----------
  const NS = 'http://www.w3.org/2000/svg';
  function sv(tag, atributy, ...deti) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atributy || {})) e.setAttribute(k, v);
    deti.flat().forEach((d) => { if (d != null) e.append(d.nodeType ? d : document.createTextNode(String(d))); });
    return e;
  }
  function jedinecne(t) {                    // názvy sloupců s UNIQUE indexem
    const mnozina = new Set();
    const il = db.exec('PRAGMA index_list(' + q(t) + ')');
    if (il.length) il[0].values.forEach((v) => {
      if (!v[2] || v[4]) return;   // jen plný UNIQUE; částečný index (WHERE ...) 1:1 nedělá
      const ii = db.exec('PRAGMA index_info(' + q(v[1]) + ')');
      if (ii.length && ii[0].values.length === 1) mnozina.add(ii[0].values[0][2]);
    });
    return mnozina;
  }
  function vztahy(tab) {
    const out = [];
    tab.forEach((t) => {
      const uniq = jedinecne(t);
      sloupce(t).forEach((c) => {
        if (!c.fk) return;
        const pkRef = c.fk.sloupec || (sloupce(c.fk.tabulka).find((x) => x.pk) || {}).name;
        out.push({ rodic: c.fk.tabulka, dite: t, sloupec: c.name, ref: pkRef, jedna: c.pk || uniq.has(c.name) });
      });
    });
    return out;
  }
  function spojovaci(tab, vz) {              // spojovací tabulka: má 2+ cizí klíče na různé tabulky a nikdo na ni neodkazuje
    return tab.map((t) => {
      if (vz.some((v) => v.rodic === t && v.dite !== t)) return null;
      const cile = [...new Set(vz.filter((v) => v.dite === t && v.rodic !== t).map((v) => v.rodic))];
      return cile.length >= 2 ? { tabulka: t, cile } : null;
    }).filter(Boolean);
  }

  function diagramVodorovne(tab, vz) {
    const W = 200, HH = 30, RH = 22, MX = 64, MY = 24;
    const info = {}; tab.forEach((t) => { info[t] = { cols: sloupce(t) }; });
    const uroven = {};
    const L = (t, zasobnik) => {
      if (uroven[t] != null) return uroven[t];
      if (zasobnik.includes(t)) return 0;
      const r = vz.filter((v) => v.dite === t && v.rodic !== t && info[v.rodic]).map((v) => v.rodic);
      return (uroven[t] = r.length ? 1 + Math.max(...r.map((x) => L(x, [...zasobnik, t]))) : 0);
    };
    tab.forEach((t) => L(t, []));
    const sloupcu = Math.max(...tab.map((t) => uroven[t])) + 1;
    let vyska = 0;
    for (let u = 0; u < sloupcu; u++) {
      let seznam = tab.filter((t) => uroven[t] === u);
      if (u > 0) {                           // seřadit podle polohy rodičů, ať se čáry míň kříží
        const stred = (t) => { const r = vz.filter((v) => v.dite === t && v.rodic !== t && info[v.rodic].y != null);
          return r.length ? r.reduce((a, v) => a + info[v.rodic].y + info[v.rodic].h / 2, 0) / r.length : 0; };
        seznam = seznam.sort((a, b) => stred(a) - stred(b));
      }
      let y = MY;
      seznam.forEach((t) => {
        const i = info[t]; i.h = HH + RH * i.cols.length; i.x = MY + u * (W + MX);
        if (u > 0) {
          const r = vz.filter((v) => v.dite === t && v.rodic !== t && info[v.rodic].y != null);
          if (r.length) y = Math.max(y, r.reduce((a, v) => a + info[v.rodic].y + info[v.rodic].h / 2, 0) / r.length - i.h / 2);
        }
        i.y = y; y += i.h + MY;
      });
      vyska = Math.max(vyska, y);
    }
    const sirka = MY * 2 + sloupcu * W + (sloupcu - 1) * MX;
    const svg = sv('svg', { viewBox: `0 0 ${sirka} ${vyska}`, role: 'img', 'aria-label': 'Schéma databáze' });
    vz.forEach((v) => {                      // čáry pod tabulkami
      if (v.rodic === v.dite || !info[v.rodic]) return;
      const rod = info[v.rodic], dit = info[v.dite];
      const ir = rod.cols.findIndex((c) => c.name === v.ref), id = dit.cols.findIndex((c) => c.name === v.sloupec);
      const y1 = rod.y + HH + RH * (ir < 0 ? 0 : ir) + RH / 2, y2 = dit.y + HH + RH * id + RH / 2;
      const zleva = rod.x < dit.x;
      const x1 = zleva ? rod.x + W : rod.x, x2 = zleva ? dit.x : dit.x + W, d = zleva ? 1 : -1;
      svg.append(sv('path', { d: `M${x1} ${y1} C${x1 + 30 * d} ${y1} ${x2 - 30 * d} ${y2} ${x2} ${y2}`, class: 'cara' }));
      svg.append(sv('text', { x: x1 + 8 * d, y: y1 - 6, class: 'kard', 'text-anchor': zleva ? 'start' : 'end' }, '1'));
      svg.append(sv('text', { x: x2 - 8 * d, y: y2 - 6, class: 'kard', 'text-anchor': zleva ? 'end' : 'start' }, v.jedna ? '1' : 'N'));
    });
    tab.forEach((t) => {
      const i = info[t];
      svg.append(sv('rect', { x: i.x, y: i.y, width: W, height: i.h, rx: 8, class: 'box' }));
      svg.append(sv('rect', { x: i.x, y: i.y, width: W, height: HH, rx: 8, class: 'hlava' }));
      svg.append(sv('text', { x: i.x + W / 2, y: i.y + 20, 'text-anchor': 'middle', class: 'nazev' }, t));
      i.cols.forEach((c, k) => {
        const yy = i.y + HH + RH * k + 15;
        svg.append(sv('text', { x: i.x + 10, y: yy, class: c.pk ? 'pk' : '' }, c.name));
        const znacka = c.pk && c.fk ? 'PK FK' : c.pk ? 'PK' : c.fk ? 'FK' : '';
        if (znacka) svg.append(sv('text', { x: i.x + W - 10, y: yy, 'text-anchor': 'end', class: 'znacka' }, znacka));
      });
    });
    return h('div', { class: 'diagram' }, svg);
  }

  // Úzká obrazovka nebo hodně úrovní: tabulky pod sebou po patrech, jen názvy, čáry shora dolů. Nic se neposouvá do strany.
  function diagramSvisle(tab, vz, sirka) {
    const BH = 40, GY = 58, PAD = 12, MEZ = 10;
    const uroven = {};
    const L = (t, zas) => {
      if (uroven[t] != null) return uroven[t];
      if (zas.includes(t)) return 0;
      const r = vz.filter((v) => v.dite === t && v.rodic !== t && tab.includes(v.rodic)).map((v) => v.rodic);
      return (uroven[t] = r.length ? 1 + Math.max(...r.map((x) => L(x, [...zas, t]))) : 0);
    };
    tab.forEach((t) => L(t, []));
    const pater = Math.max(...tab.map((t) => uroven[t])) + 1;
    const nejvic = Math.max(...Array.from({ length: pater }, (_, u) => tab.filter((t) => uroven[t] === u).length));
    const BW = Math.max(70, Math.min(150, (sirka - 2 * PAD - (nejvic - 1) * MEZ) / nejvic));
    const info = {};
    for (let u = 0; u < pater; u++) {
      const seznam = tab.filter((t) => uroven[t] === u);
      const chce = (t, i) => {
        const r = vz.filter((v) => v.dite === t && v.rodic !== t && info[v.rodic]);
        return r.length ? r.reduce((a, v) => a + info[v.rodic].x + BW / 2, 0) / r.length : (i + 0.5) * sirka / seznam.length;
      };
      const radit = seznam.map((t, i) => ({ t, c: chce(t, i) })).sort((a, b) => a.c - b.c);
      let levy = PAD;
      radit.forEach((o) => { const x = Math.max(levy, o.c - BW / 2); info[o.t] = { x, y: PAD + u * (BH + GY) }; levy = x + BW + MEZ; });
      let preteceni = levy - MEZ - (sirka - PAD);                  // posunout zpět, ať nic nepřečuhuje
      for (let k = radit.length - 1; k >= 0 && preteceni > 0; k--) {
        const i = info[radit[k].t]; const mozne = i.x - (k ? info[radit[k - 1].t].x + BW + MEZ : PAD);
        const d = Math.min(preteceni, mozne); i.x -= d; preteceni -= d;
      }
    }
    const vyska = PAD * 2 + pater * BH + (pater - 1) * GY;
    const svg = sv('svg', { viewBox: `0 0 ${sirka} ${vyska}`, role: 'img', 'aria-label': 'Schéma databáze' });
    vz.forEach((v) => {
      if (v.rodic === v.dite || !info[v.rodic] || !info[v.dite]) return;
      const r = info[v.rodic], d = info[v.dite];
      const x1 = r.x + BW / 2, y1 = r.y + BH, x2 = d.x + BW / 2, y2 = d.y, m = (y2 - y1) / 2;
      svg.append(sv('path', { d: `M${x1} ${y1} C${x1} ${y1 + m} ${x2} ${y2 - m} ${x2} ${y2}`, class: 'cara' }));
      svg.append(sv('text', { x: x1 + 6, y: y1 + 14, class: 'kard' }, '1'));
      svg.append(sv('text', { x: x2 + 6, y: y2 - 6, class: 'kard' }, v.jedna ? '1' : 'N'));
    });
    tab.forEach((t) => {
      const i = info[t];
      svg.append(sv('rect', { x: i.x, y: i.y, width: BW, height: BH, rx: 10, class: 'box' }));
      svg.append(sv('text', { x: i.x + BW / 2, y: i.y + BH / 2 + 5, 'text-anchor': 'middle', class: 'nazev' }, t));
    });
    return h('div', { class: 'diagram' }, svg);
  }
  function diagram(tab, vz) {
    const sirka = Math.min(document.documentElement.clientWidth, 980) - 70;
    const uz = sirka < 640;
    return uz ? diagramSvisle(tab, vz, Math.max(260, sirka)) : diagramVodorovne(tab, vz);
  }

  function strukturaOkno() {
    const tab = tabulky();
    if (!tab.length) return h('div', { class: 'karta' }, h('p', {}, 'V databázi nejsou žádné tabulky. Zkontroluj 01_schema.sql.'));
    const vz = vztahy(tab), spoj = spojovaci(tab, vz), sTab = new Set(spoj.map((x) => x.tabulka));
    const tabulkyPopis = tab.map((t) => {
      const uniq = jedinecne(t);
      const cr = db.exec("SELECT sql FROM sqlite_master WHERE name = ?", [t]);
      return h('details', {}, h('summary', {}, h('b', {}, t), sTab.has(t) ? ' (spojovací tabulka)' : ''),
        h('table', { class: 'responz' }, h('thead', {}, h('tr', {}, ['Sloupec', 'Typ', 'Klíč', 'Pravidla'].map((x) => h('th', {}, x)))),
          h('tbody', {}, sloupce(t).map((c) => h('tr', {},
            h('td', { 'data-label': 'Sloupec' }, c.name), h('td', { 'data-label': 'Typ' }, c.type || '–'),
            h('td', { 'data-label': 'Klíč' }, [c.pk ? 'PK' : null, c.fk ? 'FK → ' + c.fk.tabulka : null].filter(Boolean).join(', ') || '–'),
            h('td', { 'data-label': 'Pravidla' }, [c.notnull ? 'povinné' : null, uniq.has(c.name) ? 'unikátní' : null, c.dflt != null ? 'výchozí ' + c.dflt : null].filter(Boolean).join(', ') || '–'))))),
        h('pre', { class: 'sqlkod' }, cr.length ? cr[0].values[0][0] : ''));
    });
    return h('div', {},
      h('div', { class: 'karta' }, h('h2', {}, 'Schéma'), diagram(tab, vz),
        h('p', { class: 'info' }, 'Čára spojuje tabulky: 1 je strana s primárním klíčem, N strana s cizím klíčem.')),
      h('div', { class: 'karta' }, h('h2', {}, 'Tabulky'), tabulkyPopis),
      h('div', { class: 'karta' }, h('h2', {}, 'Začít znovu'),
        h('p', { class: 'tlum' }, 'Po úpravě SQL souborů nebo když se něco pokazí. Smaže se vše, co jste ve webu zadali, a data se znovu načtou ze SQL souborů.'),
        h('button', { class: 'tl nebezpecne', onclick: resetuj }, stav.resetuj ? 'Opravdu načíst znovu?' : 'Načíst znovu ze SQL souborů')));
  }

  // ---------- nástroje ----------
  async function resetuj() {
    if (!stav.resetuj) { stav.resetuj = true; vykresli(); return; }
    stav.resetuj = false;
    await nactiZnovu('Databáze znovu vytvořena ze SQL souborů.', null);
  }
  // ul = uložená databáze (nebo null). Když sedí s SQL soubory, použije se (změny zůstanou);
  // když se SQL soubory změnily, databáze se vytvoří znovu.
  async function nactiZnovu(hlaska, ul) {
    sqlTexty = await nactiTexty();
    stav.hash = hash(sqlTexty[0] + '\u0000' + sqlTexty[1]);
    stav.nazev = ((/^\s*--\s*([^\n]{1,60})/.exec(sqlTexty[0]) || [])[1] || 'Databáze').trim();   // název projektu = první řádek 01_schema.sql
    stav.varovani = []; stav.uprava = null; stav.vysledek = null; stav.smazat = null; stav.zUlozeni = null;
    if (ul && ul.h === stav.hash) { db = ul.db; }
    else {
      if (ul) hlaska = hlaska || 'SQL soubory se změnily, databáze byla vytvořena znovu.';
      db = postav(sqlTexty, stav.varovani); uloz();
    }
    zprava(hlaska || ''); vykresli();
  }

  // ---------- start ----------
  async function start() {
    try {
      SQL = await initSqlJs();
      const ul = nactiUlozenou();
      if (ul && location.protocol === 'file:') {         // dvojklik: SQL nečteme, zeptáme se jen na požádání
        db = ul.db; sqlTexty = null; stav.hash = ul.h; stav.nazev = ul.n || 'Databáze'; mdTexty = ul.m || {}; stav.zUlozeni = ul.t; vykresli();
      } else await nactiZnovu('', ul);
    } catch (e) { $('obsah').replaceChildren(h('p', { class: 'chyba' }, 'Chyba při startu: ' + e.message)); }
  }
  let uzka = document.documentElement.clientWidth < 710;
  window.addEventListener('resize', () => { const u = document.documentElement.clientWidth < 710; if (u !== uzka) { uzka = u; if (db) vykresli(); } });
  start();
})();
