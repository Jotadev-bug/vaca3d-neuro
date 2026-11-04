// main.js · arranque + interfaz de estudio
import '@fontsource-variable/inter';
import './style.css';
import * as THREE from 'three';
import { LAYERS, registry, allMeshes, root } from './geo.js';
import { SECTIONS, INFO, ALIASES, flatItems } from './data/structures.js';
import {
  start, controls, camera, layerState, applyVisibility, setSkinOpacity, sel, pick,
  frameRefs, flyTo, fitDistance, setClip, clip, clipRange, clipDefault, setPins, canvas, onFrame, setTheme,
} from './scene.js';
import * as head from './model/head.js';
import * as neck from './model/neck.js';
import * as thorax from './model/thorax.js';
import * as body from './model/body.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');

// ── construir modelo ──
const MODULES = { head, neck, thorax, body };
const only = params.get('solo')?.split(',');
for (const [name, mod] of Object.entries(MODULES)) {
  if (only && !only.includes(name)) continue;
  const n0 = allMeshes.length;
  try { mod.build(); } catch (e) { console.error(`Error construyendo ${name}:`, e); }
  // módulo dueño de cada malla (las vistas pueden mostrar solo algunos)
  for (let i = n0; i < allMeshes.length; i++) allMeshes[i].userData.owner = name;
}
root.updateMatrixWorld(true);

// ── índices ──
const ITEMS = flatItems();
const NAME = {};               // ref → nombre principal
const OCCUR = {};              // ref → [{sub, n, name}]
for (const it of ITEMS) {
  if (!it.ref) continue;
  NAME[it.ref] ??= it.name;
  (OCCUR[it.ref] ??= []).push(it);
}
const expand = (ref) => [ref, ...(ALIASES[ref] || [])];
const hasMesh = (ref) => ref && expand(ref).some((r) => registry.has(r));
const refLayer = (ref) => {
  for (const r of expand(ref)) { const o = registry.get(r)?.[0]; let l; o?.traverse((m) => { if (!l && m.isMesh) l = m.userData.layer; }); if (l) return l; }
  return null;
};
const parentOf = {};           // hija → madre (para nombrar al pulsar)
for (const [p, kids] of Object.entries(ALIASES)) kids.forEach((k) => { parentOf[k] ??= p; });

// ── estudio: progreso local ──
const SEEN_KEY = 'vaca3d.seen';
const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
const markSeen = (ref) => { if (!seen.has(ref)) { seen.add(ref); localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); renderProgress(); } };

// ── capas ──
const layersEl = $('layers');
for (const [id, l] of Object.entries(LAYERS)) {
  layerState[id] = true;
  const b = document.createElement('button');
  b.className = 'chip on'; b.dataset.layer = id;
  b.innerHTML = `<i style="background:${l.color}"></i>${l.label}`;
  b.setAttribute('aria-pressed', 'true');
  b.onclick = () => { layerState[id] = !layerState[id]; b.classList.toggle('on', layerState[id]); b.setAttribute('aria-pressed', String(layerState[id])); applyVisibility(); };
  layersEl.appendChild(b);
}
function setLayers(list) {
  for (const id of Object.keys(LAYERS)) layerState[id] = !list || list.includes(id);
  layersEl.querySelectorAll('.chip').forEach((b) => { const on = layerState[b.dataset.layer]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  applyVisibility();
}
$('skin').oninput = (e) => setSkinOpacity(parseFloat(e.target.value));

// ── vistas ──
// target = centro del área; dir = dirección de la cámara; span = [ancho, alto] en m
const VIEWS = {
  completo: { label: 'Completo', target: [-0.2, 0.85, 0], dir: [0.18, 0.22, 1], span: [3.8, 1.9], skin: 0.35 },
  cabeza: { label: 'Cabeza', target: [1.2, 1.04, 0], dir: [0.45, 0.15, 1], span: [1.15, 1.05] },
  corte_cabeza: { label: 'Corte cabeza', target: [1.2, 1.04, 0], dir: [0, 0.05, 1], span: [0.85, 0.8], clip: 'sag', clipPos: 0.0, owners: ['head'], layers: ['hueso', 'seno', 'cavidad'] },
  cuello: { label: 'Cuello', target: [0.78, 1.08, 0], dir: [0.12, 0.12, 1], span: [1.55, 1.1] },
  torax_izq: { label: 'Tórax izq.', target: [-0.2, 0.95, 0], dir: [0, 0.08, 1], span: [2.1, 1.55] },
  torax_dcho: { label: 'Tórax dcho.', target: [-0.2, 0.95, 0], dir: [0, 0.08, -1], span: [2.1, 1.55] },
  corazon: { label: 'Corazón', target: [0.0, 0.88, 0], dir: [0.35, 0.15, 1], span: [0.85, 0.75], layers: ['vaso', 'nervio', 'linfa', 'viscera', 'glandula'], hide: ['pulmon_', 'borde_basal_pulmon', 'reticulo'] },
  dorso: { label: 'Dorso y cola', target: [-1.25, 1.0, 0], dir: [0.1, 0.55, 1], span: [2.1, 1.4] },
};
const viewPose = (v) => {
  const t = new THREE.Vector3(...v.target);
  const p = t.clone().add(new THREE.Vector3(...v.dir).normalize().multiplyScalar(fitDistance(v.span)));
  return [p, t];
};
const viewsEl = $('views');
for (const [id, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.view = id;
  b.onclick = () => goView(id); viewsEl.appendChild(b);
}
function goView(id, instant = false) {
  const v = VIEWS[id]; if (!v) return;
  viewsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === id));
  sel.hidePrefix = v.hide || [];
  sel.owners = v.owners || null;
  setLayers(v.layers || null);
  applyClipUI(v.clip || 'none', v.clipPos);
  const [p, t] = viewPose(v);
  const sk = v.skin ?? 0.16; $('skin').value = sk; setSkinOpacity(sk);
  if (instant) { camera.position.copy(p); controls.target.copy(t); } else flyTo(p, t);
}

// ── cortes ──
const clipModeEl = $('clipMode'), clipRow = $('clipRow'), clipPos = $('clipPos');
function applyClipUI(mode, pos) {
  clipModeEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.clip === mode));
  clipRow.hidden = mode === 'none';
  if (mode !== 'none') {
    const [a, b] = clipRange(mode); clipPos.min = a; clipPos.max = b;
    clipPos.value = pos ?? clipDefault(mode);
  }
  setClip(mode, parseFloat(clipPos.value), clip.flip);
}
clipModeEl.onclick = (e) => { const m = e.target.dataset?.clip; if (m) applyClipUI(m); };
clipPos.oninput = () => setClip(clip.mode, parseFloat(clipPos.value), clip.flip);
$('clipFlip').onclick = () => setClip(clip.mode, clip.pos, !clip.flip);

// ── árbol del temario ──
const treeEl = $('tree');
let openSub = null;
function buildTree(filter = '') {
  const q = norm(filter);
  treeEl.innerHTML = '';
  for (const s of SECTIONS) {
    const sec = el('details', 'sec'); sec.open = !!q;
    sec.innerHTML = `<summary><span class="sid">${s.id}</span>${s.title}</summary>`;
    let count = 0;
    for (const sub of s.subs) {
      const sd = el('details', 'sub'); sd.open = !!q || openSub === sub.id; sd.dataset.sub = sub.id;
      sd.innerHTML = `<summary><span class="sid">${sub.id}</span>${sub.title}</summary>`;
      sd.addEventListener('toggle', () => { if (sd.open) { openSub = sub.id; sec.open = true; onSubOpen(sub); } });
      for (const [gname, items] of sub.groups) {
        const list = items.filter(([n, name]) => !q || norm(name).includes(q) || norm(`${sub.id} ${n}`).includes(q));
        if (!list.length) continue;
        const g = el('div', 'grp'); g.innerHTML = `<div class="gname">${gname}</div>`;
        for (const [n, name, ref, note] of list) {
          const b = el('button', 'item');
          const m = hasMesh(ref);
          b.dataset.ref = ref || '';
          b.innerHTML = `<span class="num">${n}</span><span class="nm">${name}</span>${m ? `<i class="ldot" style="background:${LAYERS[refLayer(ref)]?.color || '#ccc'}"></i>` : '<span class="tag">ficha</span>'}${ref && seen.has(ref) ? '<span class="ok" aria-label="visto">✓</span>' : ''}`;
          b.onclick = () => { openSub = sub.id; choose(ref, { n, name, note, sub }); };
          g.appendChild(b); count++;
        }
        sd.appendChild(g);
      }
      if (sd.querySelector('.item')) sec.appendChild(sd);
    }
    if (count) treeEl.appendChild(sec);
  }
}
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
$('search').oninput = (e) => buildTree(e.target.value);

function renderProgress() {
  const refs = new Set(ITEMS.filter((i) => hasMesh(i.ref)).map((i) => i.ref));
  const done = [...refs].filter((r) => seen.has(r)).length;
  $('progress').innerHTML = `<div class="bar"><span style="width:${(100 * done / refs.size).toFixed(1)}%"></span></div><small>${done} / ${refs.size} estructuras repasadas</small>`;
}

// pins de la subsección abierta
let currentSub = null;
function onSubOpen(sub) { currentSub = sub; if ($('pins').checked) showPins(); }
function showPins() {
  if (!currentSub) { setPins([]); return; }
  const list = [];
  for (const [, items] of currentSub.groups) for (const [n, name, ref] of items) {
    if (!ref) continue;
    const r = registry.has(ref) ? ref : (ALIASES[ref] || []).find((k) => registry.has(k));
    if (r) list.push({ ref: r, n, name });
  }
  setPins(list).forEach((p) => { p.el.onclick = () => choose(p.ref); });
}
$('pins').onchange = (e) => (e.target.checked ? showPins() : setPins([]));
$('isolate').onchange = (e) => { sel.isolate = e.target.checked; applyVisibility(); };

// ── selección y ficha ──
const card = $('card');
function choose(ref, ctx = {}, { focus = true } = {}) {
  if (!ref) { showCard(null, ctx); return; }
  sel.refs = new Set(expand(ref));
  applyVisibility();
  showCard(ref, ctx);
  if (hasMesh(ref)) { markSeen(ref); if (focus) frameRefs(sel.refs); }
  treeEl.querySelectorAll('.item').forEach((b) => b.classList.toggle('active', b.dataset.ref === ref));
}
function showCard(ref, ctx) {
  card.hidden = false;
  const info = ref ? INFO[ref] : null;
  const layer = ref ? refLayer(ref) : null;
  $('cardLayer').innerHTML = layer ? `<i style="background:${LAYERS[layer].color}"></i>${LAYERS[layer].label}` : '<i style="background:#bbb"></i>Ficha de estudio';
  $('cardTitle').textContent = (ref && NAME[ref]) || ctx.name || '';
  const occ = ref ? OCCUR[ref] || [] : [];
  const refList = occ.length ? occ : ctx.sub ? [{ sub: ctx.sub.id, n: ctx.n }] : [];
  $('cardRefs').innerHTML = refList.map((o) => `<span class="ref"><b>${o.sub}</b> nº ${o.n}</span>`).join('');
  // ref desconocida (p. ej. un ?sel= mal escrito): sin ficha vacía
  if (!(ref ? NAME[ref] || hasMesh(ref) : ctx.name)) { card.hidden = true; return; }
  $('cardDesc').textContent = ctx.note || info?.[1] || (hasMesh(ref) ? '' : 'Concepto sin malla propia: estúdialo con esta ficha.');
  $('cardFocus').disabled = $('cardIsolate').disabled = !hasMesh(ref);
  $('cardFocus').onclick = () => frameRefs(sel.refs);
  $('cardIsolate').onclick = () => { $('isolate').checked = sel.isolate = !sel.isolate; applyVisibility(); };
}
function clearSel() { sel.refs = new Set(); applyVisibility(); card.hidden = true; treeEl.querySelectorAll('.item.active').forEach((b) => b.classList.remove('active')); }
$('cardClose').onclick = clearSel;

// clic y hover en el lienzo
const tooltip = $('tooltip');
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const h = pick(e.clientX, e.clientY);
  if (quiz.active && quiz.mode === 'find') { quizClick(h); return; }
  if (!h) { clearSel(); return; }
  const r = h.object.userData.ref;
  choose(OCCUR[r] ? r : parentOf[r] || r, {}, { focus: false });
});
let hoverRaf = 0;
canvas.addEventListener('pointermove', (e) => {
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (e.buttons) { tooltip.hidden = true; return; }
    const h = pick(e.clientX, e.clientY);
    const r = h?.object.userData.ref;
    if (!r || (quiz.active)) { tooltip.hidden = true; canvas.style.cursor = ''; return; }
    tooltip.hidden = false; canvas.style.cursor = 'pointer';
    tooltip.textContent = NAME[r] || NAME[parentOf[r]] || r;
    tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
  });
});
canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; });

// ── examen ──
const quiz = { active: false, mode: 'id', scope: 'all', target: null, ok: 0, total: 0, answered: false };
const scopeEl = $('quizScope');
scopeEl.innerHTML = `<option value="all">Todo el temario</option>` + SECTIONS.flatMap((s) => s.subs.map((u) => `<option value="${u.id}">${u.id} · ${u.title}</option>`)).join('');
function quizPool() {
  const refs = new Set(ITEMS.filter((i) => hasMesh(i.ref) && (quiz.scope === 'all' || i.sub === quiz.scope)).map((i) => i.ref));
  return [...refs];
}
function quizNext() {
  const pool = quizPool(); if (!pool.length) return;
  quiz.answered = false; $('quizFeedback').textContent = '';
  quiz.target = pool[Math.floor(Math.random() * pool.length)];
  const opts = $('quizOpts'); opts.innerHTML = '';
  if (quiz.mode === 'id') {
    $('quizQ').innerHTML = '¿Qué estructura está resaltada?';
    sel.refs = new Set(expand(quiz.target)); sel.isolate = false; applyVisibility(); frameRefs(sel.refs, { pad: 3.2 });
    const wrong = shuffle(pool.filter((r) => r !== quiz.target && NAME[r] !== NAME[quiz.target])).slice(0, 3);
    for (const r of shuffle([quiz.target, ...wrong])) {
      const b = el('button', 'opt'); b.textContent = NAME[r];
      b.onclick = () => answer(r === quiz.target, b);
      opts.appendChild(b);
    }
  } else {
    sel.refs = new Set(); applyVisibility();
    $('quizQ').innerHTML = `Haz clic en: <b>${NAME[quiz.target]}</b>`;
  }
}
function answer(ok, btn) {
  if (quiz.answered) return;
  quiz.answered = true; quiz.total++; if (ok) quiz.ok++;
  $('quizScore').textContent = `${quiz.ok} / ${quiz.total}`;
  $('quizFeedback').textContent = ok ? '¡Correcto!' : `Era: ${NAME[quiz.target]}`;
  $('quizFeedback').className = ok ? 'good' : 'bad';
  if (btn) btn.classList.add(ok ? 'good' : 'bad');
  $('quizOpts').querySelectorAll('.opt').forEach((b) => { if (b.textContent === NAME[quiz.target]) b.classList.add('good'); });
  if (quiz.mode === 'find') { sel.refs = new Set(expand(quiz.target)); applyVisibility(); frameRefs(sel.refs, { pad: 3 }); }
  if (ok) markSeen(quiz.target);
}
function quizClick(h) {
  if (quiz.answered) return;
  const r = h?.object.userData.ref;
  const ok = !!r && (expand(quiz.target).includes(r) || NAME[r] === NAME[quiz.target]);
  answer(ok);
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function toggleQuiz(on = !quiz.active) {
  quiz.active = on; $('quiz').hidden = !on; card.hidden = true;
  document.body.classList.toggle('quizzing', on);
  if (on) { if (openSub && quiz.scope === 'all') { scopeEl.value = openSub; quiz.scope = openSub; } quizNext(); } else clearSel();
}
$('btnQuiz').onclick = () => toggleQuiz();
$('quizClose').onclick = () => toggleQuiz(false);
$('quizNext').onclick = quizNext;
scopeEl.onchange = () => { quiz.scope = scopeEl.value; quizNext(); };
$('quizMode').onclick = (e) => {
  const m = e.target.dataset?.q; if (!m) return;
  quiz.mode = m; $('quizMode').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.q === m)); quizNext();
};

// ── tema claro / oscuro (index.html fija el inicial antes de pintar) ──
const themeBtn = $('btnTheme');
function applyTheme(t, save = false) {
  const dark = t === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  themeBtn.title = dark ? 'Modo claro (D)' : 'Modo oscuro (D)';
  setTheme(dark);
  if (save) localStorage.setItem('vaca3d.theme', dark ? 'dark' : 'light');
}
const toggleTheme = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
themeBtn.onclick = toggleTheme;
applyTheme(document.documentElement.dataset.theme);

// ── ayuda y atajos ──
$('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
$('helpClose').onclick = () => { $('help').hidden = true; localStorage.setItem('vaca3d.help', '1'); };
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === '/') { e.preventDefault(); $('search').focus(); }
  else if (e.key === 'Escape') { if (quiz.active) toggleQuiz(false); else clearSel(); $('help').hidden = true; }
  else if (e.key.toLowerCase() === 'f' && sel.refs.size) frameRefs(sel.refs);
  else if (e.key.toLowerCase() === 'q') toggleQuiz();
  else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) toggleTheme();
  else if (e.key === '?') $('help').hidden = !$('help').hidden;
});

// ── inicio ──
buildTree(); renderProgress();
start();
goView(params.get('view') || 'completo', true);
if (params.get('layers')) setLayers(params.get('layers').split(','));
if (params.get('skin')) { $('skin').value = params.get('skin'); setSkinOpacity(parseFloat(params.get('skin'))); }
if (params.get('clip')) { const [m, p] = params.get('clip').split(':'); applyClipUI(m, p !== undefined ? parseFloat(p) : undefined); if (params.has('flip')) setClip(clip.mode, clip.pos, true); }
if (params.get('cam')) camera.position.set(...params.get('cam').split(',').map(Number));
if (params.get('target')) controls.target.set(...params.get('target').split(',').map(Number));
if (params.get('sel')) choose(params.get('sel'), {}, { focus: !params.get('cam') });
if (params.get('pins')) { const sub = SECTIONS.flatMap((s) => s.subs).find((s) => s.id === params.get('pins')); if (sub) { currentSub = sub; $('pins').checked = true; showPins(); } }
if (SHOT && params.get('ui') === '0') document.body.classList.add('noui');
if (!SHOT && !localStorage.getItem('vaca3d.help')) $('help').hidden = false;
applyVisibility();
$('loader').classList.add('done');
onFrame(() => {});
window.__vaca = { registry, allMeshes, camera, controls };
