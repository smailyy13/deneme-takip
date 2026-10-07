'use strict';

// ---- Ders tanımları (soru sayıları ÖSYM formatına göre) ----
const EXAMS = {
  TYT: [
    { group: 'Türkçe', subjects: [['turkce', 'Türkçe', 40]] },
    { group: 'Sosyal Bilimler', subjects: [['tarih', 'Tarih', 5], ['cografya', 'Coğrafya', 5], ['felsefe', 'Felsefe', 5], ['din', 'Din Kültürü', 5]] },
    { group: 'Temel Matematik', subjects: [['mat', 'Matematik', 40]] },
    { group: 'Fen Bilimleri', subjects: [['fizik', 'Fizik', 7], ['kimya', 'Kimya', 7], ['biyoloji', 'Biyoloji', 6]] },
  ],
  AYT: [
    { group: 'Matematik', subjects: [['mat', 'Matematik', 40]] },
    { group: 'Fen Bilimleri', subjects: [['fizik', 'Fizik', 14], ['kimya', 'Kimya', 13], ['biyoloji', 'Biyoloji', 13]] },
    { group: 'Edebiyat – Sosyal 1', subjects: [['edebiyat', 'Edebiyat', 24], ['tarih1', 'Tarih-1', 10], ['cografya1', 'Coğrafya-1', 6]] },
    { group: 'Sosyal Bilimler 2', subjects: [['tarih2', 'Tarih-2', 11], ['cografya2', 'Coğrafya-2', 11], ['felsefe', 'Felsefe Grubu', 12], ['din', 'Din Kültürü', 6]] },
  ],
};
const subjectsOf = type => EXAMS[type].flatMap(g => g.subjects);
const maxOf = type => subjectsOf(type).reduce((s, x) => s + x[2], 0);

// ---- Veri: GitHub'daki gizli depoda data.json olarak tutulur ----
// Cihazda yalnızca bağlantı bilgisi (depo adı + token) saklanır, denemeler değil.
const CFG_KEY = 'deneme-takip-baglanti';
const OLD_KEY = 'deneme-takip-v1'; // eski sürümün yerel verisi (buluta aktarmak için)
const DEFAULT_REPO = 'smailyy13/deneme-takip-veri';
let cfg = loadCfg();
let data = [];
let sha = null;
let loaded = false;

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; }
}

const api = (method, body) => fetch(`https://api.github.com/repos/${cfg.repo}/contents/data.json`, {
  method,
  cache: 'no-store',
  headers: {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    ...(body && { 'Content-Type': 'application/json' }),
  },
  body: body && JSON.stringify(body),
});
const b64enc = s => { let bin = ''; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

class ApiError extends Error {}
function errText(e) {
  if (!(e instanceof ApiError)) return 'İnternet bağlantısını kontrol et.';
  return {
    401: 'Token geçersiz ya da süresi dolmuş.',
    403: 'Token\'ın bu depoya yazma izni yok (Contents: Read and write olmalı).',
    404: 'Depo bulunamadı ya da token\'ın bu depoya erişimi yok.',
    silinmiş: 'Bu deneme başka bir cihazdan silinmiş.',
    çakışma: 'Başka bir cihaz aynı anda kaydediyor, tekrar dene.',
  }[e.message] || `GitHub hatası (${e.message}).`;
}

function setStatus(text) {
  $('#status').textContent = text;
}

async function pull() {
  const r = await api('GET');
  if (!r.ok) throw new ApiError(r.status);
  const j = await r.json();
  sha = j.sha;
  data = JSON.parse(b64dec(j.content) || '[]');
  loaded = true;
}

// En güncel veriyi çekip değişikliği onun üstüne uygular; başka cihaz araya girerse tekrar dener.
async function commit(fn, message) {
  setStatus('Kaydediliyor…');
  try {
    for (let i = 0; i < 3; i++) {
      await pull();
      fn(data);
      const r = await api('PUT', { message, sha, content: b64enc(JSON.stringify(data, null, 1)) });
      if (r.ok) { sha = (await r.json()).content.sha; return true; }
      if (r.status !== 409 && r.status !== 422) throw new ApiError(r.status);
    }
    throw new ApiError('çakışma');
  } catch (e) {
    alert('Kaydedilemedi: ' + errText(e));
    return false;
  } finally {
    setStatus('');
  }
}

async function refresh() {
  if (!cfg.token) return;
  setStatus('Yükleniyor…');
  try { await pull(); } catch (e) { setStatus(''); $('#list').innerHTML = `<div class="empty-state">Veriler alınamadı: ${esc(errText(e))}<br><br><a class="btn" href="#settings">Bağlantı ayarları</a></div>`; return false; }
  setStatus('');
  return true;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- Yardımcılar ----
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const net = r => r.d - r.y / 4;
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const longDate = s => parseDate(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
const shortDate = s => parseDate(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

function totals(ex) {
  let d = 0, y = 0, b = 0;
  for (const r of Object.values(ex.results)) { d += r.d; y += r.y; b += r.b; }
  return { d, y, b, net: d - y / 4 };
}
const byDate = (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

// ---- Yönlendirme (hash ile; telefonda geri tuşu çalışsın diye) ----
let listFilter = 'ALL';
let statsType = 'TYT';
let statsSubject = 'TOTAL';

function route() {
  const h = location.hash.slice(1) || 'list';
  const [view, id] = h.split('/');
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view || (view === 'd' && t.dataset.view === 'list') || (view === 'edit' && t.dataset.view === 'form')));

  if (view === 'settings' || !cfg.token) { renderSettings(); show('settings'); }
  else if (!loaded) { show('list'); }
  else if (view === 'd' && find(id)) { renderDetail(find(id)); show('detail'); }
  else if (view === 'edit' && find(id)) { openForm(find(id)); show('form'); }
  else if (view === 'form') { openForm(null); show('form'); }
  else if (view === 'stats') { renderStats(); show('stats'); }
  else { renderList(); show('list'); }
  window.scrollTo(0, 0);
}
const show = name => $('#view-' + name).classList.add('active');
const find = id => data.find(x => x.id === id);
const go = h => { location.hash = h; };

$$('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
window.addEventListener('hashchange', route);

// ---- Liste ----
$$('[data-filter]').forEach(c => c.addEventListener('click', () => {
  listFilter = c.dataset.filter;
  $$('[data-filter]').forEach(x => x.classList.toggle('active', x === c));
  renderList();
}));

function renderList() {
  const items = data.filter(x => listFilter === 'ALL' || x.type === listFilter).sort(byDate).reverse();
  if (!items.length) {
    $('#list').innerHTML = `<div class="empty-state">Henüz deneme yok.<br><br><button class="btn" onclick="go('form')">İlk denemeni ekle</button></div>`;
    return;
  }
  $('#list').innerHTML = items.map(x => {
    const t = totals(x);
    const nc = x.comments.length;
    return `<div class="item" onclick="go('d/${x.id}')">
      <span class="badge">${x.type}</span>
      <div class="info">
        <div class="name">${esc(x.name)}</div>
        <div class="meta">${parseDate(x.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${t.d}D ${t.y}Y ${t.b}B${nc ? ` · 💬 ${nc}` : ''}</div>
      </div>
      <div class="net">${fmt(t.net)}<small>net</small></div>
    </div>`;
  }).join('');
}

// ---- Detay ----
function renderDetail(ex) {
  const t = totals(ex);
  const rows = subjectsOf(ex.type).filter(([k]) => ex.results[k]).map(([k, label, max]) => {
    const r = ex.results[k];
    return `<tr><td>${label} <small style="color:var(--muted)">/${max}</small></td><td class="d">${r.d}</td><td class="y">${r.y}</td><td class="b">${r.b}</td><td class="n">${fmt(net(r))}</td></tr>`;
  }).join('');
  const comments = ex.comments.length
    ? ex.comments.map(c => `<div class="comment"><p>${esc(c.text)}</p><div class="cmeta"><span>${new Date(c.at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</span><button data-cid="${c.id}">Sil</button></div></div>`).join('')
    : '<p class="hint">Henüz yorum yok.</p>';

  $('#view-detail').innerHTML = `
    <button class="back" onclick="history.length > 1 ? history.back() : go('list')">← Geri</button>
    <div class="card">
      <div class="detail-head">
        <div>
          <span class="badge">${ex.type}</span>
          <h2 style="margin:8px 0 2px">${esc(ex.name)}</h2>
          <div class="hint" style="margin:0">📅 ${longDate(ex.date)}</div>
        </div>
        <div class="big-net">${fmt(t.net)}<small>toplam net</small></div>
      </div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Ders</th><th>D</th><th>Y</th><th>B</th><th>Net</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Ders girilmemiş</td></tr>'}</tbody>
        <tfoot><tr><td>Toplam</td><td class="d">${t.d}</td><td class="y">${t.y}</td><td class="b">${t.b}</td><td class="n">${fmt(t.net)}</td></tr></tfoot>
      </table>
    </div>
    <div class="card">
      <h3>Yorumlar</h3>
      <div id="comments">${comments}</div>
      <form class="comment-form" id="commentForm">
        <textarea rows="3" placeholder="Yorum yaz…" required></textarea>
        <div class="actions"><button class="btn">Yorum ekle</button></div>
      </form>
    </div>
    <div class="actions">
      <button class="btn danger" id="delBtn">Denemeyi sil</button>
      <button class="btn ghost" onclick="go('edit/${ex.id}')">Düzenle</button>
    </div>`;

  // Değişiklik en güncel veriye uygulanır; deneme başka cihazdan silindiyse hata verir.
  const onThis = fn => d => {
    const cur = d.find(x => x.id === ex.id);
    if (!cur) throw new ApiError('silinmiş');
    fn(cur);
  };
  const reshow = () => find(ex.id) ? renderDetail(find(ex.id)) : go('list');

  $('#commentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const text = e.target.querySelector('textarea').value.trim();
    if (!text) return;
    btn.disabled = true;
    const c = { id: uid(), text, at: Date.now() };
    if (await commit(onThis(cur => cur.comments.push(c)), `Yorum: ${ex.name}`)) reshow();
    else btn.disabled = false;
  });
  $$('#comments [data-cid]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Yorum silinsin mi?')) return;
    await commit(onThis(cur => { cur.comments = cur.comments.filter(c => c.id !== b.dataset.cid); }), `Yorum silindi: ${ex.name}`);
    reshow();
  }));
  $('#delBtn').addEventListener('click', async () => {
    if (!confirm(`"${ex.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    if (await commit(d => { const i = d.findIndex(x => x.id === ex.id); if (i >= 0) d.splice(i, 1); }, `Silindi: ${ex.name}`)) go('list');
  });
}

// ---- Form ----
let editing = null;
const form = $('#form');

function currentType() { return form.type.value; }

function openForm(ex) {
  editing = ex;
  form.reset();
  $('#formTitle').textContent = ex ? 'Denemeyi Düzenle' : 'Yeni Deneme';
  $('#formError').textContent = '';
  form.comment.closest('.field').style.display = ex ? 'none' : '';
  form.type.value = ex ? ex.type : (listFilter === 'AYT' ? 'AYT' : 'TYT');
  form.name.value = ex ? ex.name : '';
  form.date.value = ex ? ex.date : today();
  buildSubjects(ex ? ex.results : {});
}

function buildSubjects(results) {
  const type = currentType();
  $('#subjects').innerHTML = EXAMS[type].map(g => `
    <div class="group-title">${g.group}</div>
    <div class="subj subj-head"><span></span><span>Doğru</span><span>Yanlış</span><span>Boş</span><span>Net</span></div>
    ${g.subjects.map(([k, label, max]) => {
      const r = results[k];
      return `<div class="subj" data-key="${k}" data-max="${max}">
        <div class="sname">${label}<small>${max} soru</small></div>
        <input class="d" type="number" inputmode="numeric" min="0" max="${max}" value="${r ? r.d : ''}" aria-label="${label} doğru">
        <input class="y" type="number" inputmode="numeric" min="0" max="${max}" value="${r ? r.y : ''}" aria-label="${label} yanlış">
        <input class="b" type="number" inputmode="numeric" min="0" max="${max}" value="${r ? r.b : ''}" aria-label="${label} boş" ${r ? 'data-manual="1"' : ''}>
        <div class="snet">–</div>
      </div>`;
    }).join('')}`).join('');
  $$('#subjects .subj[data-key]').forEach(updateRow);
  updateTotal();
}

const num = el => el.value === '' ? null : Math.max(0, Math.floor(Number(el.value)) || 0);

function readRow(row) {
  const [d, y, b] = ['.d', '.y', '.b'].map(s => num(row.querySelector(s)));
  if (d === null && y === null && b === null) return null;
  return { d: d || 0, y: y || 0, b: b || 0 };
}

function updateRow(row) {
  const r = readRow(row);
  const max = +row.dataset.max;
  const bad = r && r.d + r.y + r.b > max;
  row.querySelectorAll('input').forEach(i => i.classList.toggle('invalid', !!bad));
  row.querySelector('.snet').textContent = r ? fmt(net(r)) : '–';
  return { r, bad };
}

function updateTotal() {
  let d = 0, y = 0, b = 0, any = false;
  $$('#subjects .subj[data-key]').forEach(row => {
    const r = readRow(row);
    if (r) { any = true; d += r.d; y += r.y; b += r.b; }
  });
  $('#formTotal').textContent = any ? `Toplam: ${d}D ${y}Y ${b}B · ${fmt(d - y / 4)} net` : '';
}

$('#subjects').addEventListener('input', e => {
  const row = e.target.closest('.subj');
  if (!row) return;
  const bEl = row.querySelector('.b');
  if (e.target === bEl) bEl.dataset.manual = bEl.value === '' ? '' : '1';
  else if (!bEl.dataset.manual) {
    // Boş sayısını otomatik doldur
    const d = num(row.querySelector('.d')), y = num(row.querySelector('.y'));
    bEl.value = d === null && y === null ? '' : Math.max(0, +row.dataset.max - (d || 0) - (y || 0));
  }
  updateRow(row); updateTotal();
});

form.addEventListener('change', e => {
  if (e.target.name === 'type') buildSubjects({});
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#formError');
  const name = form.name.value.trim();
  const date = form.date.value;
  if (!name) return err.textContent = 'Deneme adını yaz.';
  if (!date) return err.textContent = 'Tarihi seç.';

  const results = {};
  for (const row of $$('#subjects .subj[data-key]')) {
    const { r, bad } = updateRow(row);
    if (bad) {
      row.querySelector('input').focus();
      return err.textContent = `${row.querySelector('.sname').firstChild.textContent}: D+Y+B soru sayısını (${row.dataset.max}) geçemez.`;
    }
    if (r) results[row.dataset.key] = r;
  }
  if (!Object.keys(results).length) return err.textContent = 'En az bir ders gir.';

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.disabled = true;
  let id, ok;
  if (editing) {
    id = editing.id;
    ok = await commit(d => {
      const cur = d.find(x => x.id === id);
      if (!cur) throw new ApiError('silinmiş');
      Object.assign(cur, { type: currentType(), name, date, results });
    }, `Düzenlendi: ${name}`);
  } else {
    const comment = form.comment.value.trim();
    const ex = {
      id: uid(), type: currentType(), name, date, results, createdAt: Date.now(),
      comments: comment ? [{ id: uid(), text: comment, at: Date.now() }] : [],
    };
    id = ex.id;
    ok = await commit(d => d.push(ex), `Yeni ${ex.type} denemesi: ${name}`);
  }
  submitBtn.disabled = false;
  if (ok) { history.replaceState(null, '', '#d/' + id); route(); }
});

$('#cancelBtn').addEventListener('click', () => history.length > 1 ? history.back() : go('list'));

// ---- Grafikler ----
$$('[data-stype]').forEach(c => c.addEventListener('click', () => {
  statsType = c.dataset.stype; statsSubject = 'TOTAL';
  $$('[data-stype]').forEach(x => x.classList.toggle('active', x === c));
  renderStats();
}));

function lineChart(points, maxY) {
  // points: [{label, value}]
  // Genişlik ekrana göre: yazılar telefonda da okunur boyutta kalsın
  const W = Math.max(300, Math.min(680, $('main').clientWidth - 64)), H = 230, L = 34, R = 14, T = 20, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const vals = points.map(p => p.value);
  const lo = Math.min(0, ...vals);
  let hi = Math.max(...vals, 1);
  hi = Math.min(maxY, Math.ceil(hi * 1.15 / 5) * 5) || 5;
  if (hi <= lo) hi = lo + 5;
  const x = i => L + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = v => T + ih - ((v - lo) / (hi - lo)) * ih;

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4;
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const step = Math.ceil(points.length / 8);
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1)
      svg += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${p.label}</text>`;
  });
  if (points.length > 1)
    svg += `<polyline class="line" points="${points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}"/>`;
  const showVals = points.length <= 12;
  points.forEach((p, i) => {
    svg += `<circle class="dot" cx="${x(i)}" cy="${y(p.value)}" r="4"><title>${esc(p.title)}: ${fmt(p.value)} net</title></circle>`;
    if (showVals) svg += `<text class="val" x="${x(i)}" y="${y(p.value) - 9}">${fmt(p.value)}</text>`;
  });
  return svg + '</svg>';
}

function renderStats() {
  const list = data.filter(x => x.type === statsType).sort(byDate);
  const el = $('#stats');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">${statsType} denemesi yok. Grafikler deneme ekledikçe oluşur.</div>`;
    return;
  }
  const nets = list.map(x => totals(x).net);
  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const last = nets[nets.length - 1];
  const prev = nets.length > 1 ? nets[nets.length - 2] : null;
  const diff = prev === null ? '' : ` <small style="color:${last >= prev ? 'var(--ok)' : 'var(--bad)'}">${last >= prev ? '▲' : '▼'}${fmt(Math.abs(last - prev))}</small>`;

  const subs = subjectsOf(statsType);
  const chips = [['TOTAL', 'Toplam'], ...subs.map(([k, l]) => [k, l])]
    .map(([k, l]) => `<button class="chip ${statsSubject === k ? 'active' : ''}" data-subj="${k}">${l}</button>`).join('');

  let points, maxY, title;
  if (statsSubject === 'TOTAL') {
    points = list.map((x, i) => ({ label: shortDate(x.date), title: x.name, value: nets[i] }));
    maxY = maxOf(statsType); title = 'Toplam net';
  } else {
    const s = subs.find(s => s[0] === statsSubject);
    points = list.filter(x => x.results[s[0]]).map(x => ({ label: shortDate(x.date), title: x.name, value: net(x.results[s[0]]) }));
    maxY = s[2]; title = `${s[1]} neti`;
  }

  // Ders ortalamaları
  const bars = subs.map(([k, l, max]) => {
    const rs = list.filter(x => x.results[k]).map(x => net(x.results[k]));
    if (!rs.length) return '';
    const a = rs.reduce((p, c) => p + c, 0) / rs.length;
    return `<div class="bar-row"><span>${l}</span><div class="track"><div class="fill" style="width:${Math.max(0, (a / max) * 100)}%"></div></div><b>${fmt(a)}</b></div>`;
  }).join('');

  el.innerHTML = `
    <div class="summary">
      <div class="stat"><b>${list.length}</b><span>deneme</span></div>
      <div class="stat"><b>${fmt(avg)}</b><span>ortalama net</span></div>
      <div class="stat"><b>${fmt(Math.max(...nets))}</b><span>en yüksek</span></div>
      <div class="stat"><b>${fmt(last)}${diff}</b><span>son deneme</span></div>
    </div>
    <div class="card">
      <h3>${title}</h3>
      <div class="subj-select">${chips}</div>
      ${points.length ? lineChart(points, maxY) : '<p class="hint">Bu ders için girilmiş veri yok.</p>'}
    </div>
    <div class="card bars">
      <h3>Ders ortalamaları</h3>
      ${bars}
    </div>`;
  $$('[data-subj]').forEach(c => c.addEventListener('click', () => { statsSubject = c.dataset.subj; renderStats(); }));
}

// ---- Yedekleme ----
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deneme-yedek-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  let arr;
  try {
    arr = JSON.parse(await file.text());
    if (!Array.isArray(arr)) throw 0;
  } catch {
    alert('Dosya okunamadı.');
    e.target.value = '';
    return;
  }
  e.target.value = '';
  let n = 0;
  if (await commit(d => { n = merge(d, arr); }, 'Yedekten yüklendi')) {
    renderList();
    alert(`${n} deneme yüklendi.`);
  }
});

// Yalnızca henüz olmayan denemeleri ekler; eklenen sayısını döner.
function merge(target, arr) {
  const ids = new Set(target.map(x => x.id));
  const added = arr.filter(x => x && x.id && x.type in EXAMS && x.results && !ids.has(x.id))
    .map(x => ({ comments: [], createdAt: Date.now(), ...x }));
  target.push(...added);
  return added.length;
}

// ---- Bağlantı ayarları ----
function renderSettings() {
  const f = $('#settingsForm');
  f.repo.value = cfg.repo || DEFAULT_REPO;
  f.token.value = cfg.token || '';
  $('#settingsError').textContent = '';
  $('#disconnectBtn').hidden = !cfg.token;
}

$('#settingsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const next = { repo: f.repo.value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, ''), token: f.token.value.trim() };
  if (!/^[\w.-]+\/[\w.-]+$/.test(next.repo)) return $('#settingsError').textContent = 'Depo "kullanıcı/depo" biçiminde olmalı.';
  if (!next.token) return $('#settingsError').textContent = 'Token\'ı yapıştır.';
  const prev = cfg;
  cfg = next;
  setStatus('Bağlanıyor…');
  try {
    await pull();
  } catch (err) {
    cfg = prev;
    setStatus('');
    return $('#settingsError').textContent = errText(err);
  }
  setStatus('');
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {}
  await migrateLocal();
  go('list'); route();
});

$('#disconnectBtn').addEventListener('click', () => {
  if (!confirm('Bu cihazın bağlantısı kesilsin mi? Veriler GitHub\'da kalır.')) return;
  try { localStorage.removeItem(CFG_KEY); } catch {}
  cfg = {}; data = []; loaded = false; sha = null;
  route();
});

// Eski sürümde bu cihaza kaydedilmiş denemeleri buluta taşır.
async function migrateLocal() {
  let old;
  try { old = JSON.parse(localStorage.getItem(OLD_KEY)); } catch {}
  if (!Array.isArray(old) || !old.length) return;
  if (!confirm(`Bu cihazda daha önce kaydedilmiş ${old.length} deneme var. GitHub'a aktarılsın mı?`)) return;
  if (await commit(d => merge(d, old), 'Cihazdaki eski denemeler aktarıldı')) {
    try { localStorage.removeItem(OLD_KEY); } catch {}
  }
}

// Sayfaya geri dönünce diğer cihazlardaki değişiklikleri çek (form açıkken dokunma).
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !cfg.token) return;
  const view = (location.hash.slice(1) || 'list').split('/')[0];
  if (view === 'form' || view === 'edit' || view === 'settings') return;
  if (await refresh()) route();
});

(async () => {
  if (cfg.token) {
    $('#list').innerHTML = '<div class="empty-state">Yükleniyor…</div>';
    route();
    if (await refresh()) { await migrateLocal(); route(); }
  } else {
    route();
  }
})();
