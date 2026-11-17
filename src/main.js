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
import * as abdomen from './model/abdomen.js';
import * as p11 from './model/p11.js';
import * as miembros from './model/miembros.js';
import * as toro from './model/toro.js';
import { THORACIC, LUMBAR } from './frame.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');

// ── construir modelo ──
const MODULES = { head, neck, thorax, body, abdomen, p11, miembros, toro };
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
for (const v of Object.values(VIEWS)) { v.p = 9; v.hide ??= ['reg_']; }
// ── Práctica 10 · abdomen ──
// hide = prefijos de refs ocultas; hideLayers = capas apagadas (por defecto la pared abdominal)
const NOT_STOMACH = ['om_', 'pa_', 'reg_', 'duodeno', 'yeyuno', 'ileon', 'ciego', 'colon', 'recto', 'pancreas', 'mesenterio', 'nnll_yey', 'higado', 'vesicula', 'bazo', 'rinon', 'v_porta', 'v_cava', 'aorta_abd', 'pliegue_ileo', 'n_', 'ultima', 'tuberosidad', 'esofago'];
const ABD_ONLY = { owners: ['abdomen'], hideLayers: ['pared', 'nervio', 'proyeccion'] };
const corte = (label, x) => ({ label, target: [x, 0.92, 0], dir: [-1, 0.06, 0.02], span: [0.95, 0.85], clip: 'tr', clipPos: x, flip: true, hide: ['reg_'], skin: 0.12 });
Object.assign(VIEWS, {
  abd_izq: { p: 10, label: 'Abdomen izq.', target: [-0.88, 0.88, 0], dir: [0, 0.1, 1], span: [1.45, 0.95], hide: ['reg_', 'om_mayor_sup'], skin: 0.1 },
  abd_dcho: { p: 10, label: 'Abdomen dcho.', target: [-0.88, 0.88, 0], dir: [0, 0.1, -1], span: [1.45, 0.95], hide: ['reg_'], skin: 0.1 },
  abd_omentos: { p: 10, label: 'Omentos', target: [-0.95, 0.85, 0], dir: [-0.15, 0.05, -1], span: [1.25, 0.85], hide: ['reg_'], skin: 0.06 },
  // regiones limpias: piel + huesos + manchas; el resto se puede encender en Capas
  regiones: { p: 10, label: 'Regiones', target: [-0.85, 0.9, 0], dir: [0, 0.12, 1], span: [1.9, 1.15], hideLayers: ['pared', 'viscera', 'vaso', 'nervio', 'linfa', 'omento', 'musculo', 'glandula', 'cavidad', 'seno'], skin: 0.35 },
  pared: { p: 10, label: 'Pared', target: [-0.95, 0.86, 0], dir: [-0.35, 0.05, 1], span: [1.45, 1.0], hideLayers: [], hide: ['reg_'], skin: 0.0 },
  estomago_izq: { p: 10, label: 'Estómago izq.', target: [-0.88, 0.86, 0.04], dir: [0.1, 0.18, 1], span: [1.2, 0.75], ...ABD_ONLY, hide: NOT_STOMACH },
  estomago_dcho: { p: 10, label: 'Estómago dcho.', target: [-0.82, 0.84, -0.02], dir: [-0.05, 0.18, -1], span: [1.2, 0.75], ...ABD_ONLY, hide: NOT_STOMACH },
  interior: { p: 10, label: 'Interior', target: [-0.86, 0.86, 0.05], dir: [0.05, 0.12, 1], span: [0.95, 0.6], ...ABD_ONLY, hide: NOT_STOMACH, clip: 'sag', clipPos: 0.12 },
  corte_t10: corte('Corte T10', THORACIC[9].x),
  corte_t13: corte('Corte T13', THORACIC[12].x),
  corte_l3: corte('Corte L3', LUMBAR[2].x),
  corte_l5: corte('Corte L5', LUMBAR[4].x),
  corte_horizontal: { p: 10, label: 'Horizontal', target: [-0.85, 0.86, 0], dir: [0, 1, 0.06], span: [1.5, 0.9], clip: 'dor', clipPos: 0.86, hide: ['reg_'], skin: 0.1 },
  paramediano: { p: 10, label: 'Paramediano', target: [-0.45, 0.85, 0], dir: [0, 0.05, 1], span: [1.1, 0.75], clip: 'sag', clipPos: 0.06, hide: ['reg_'], skin: 0.1 },
  visceras: { p: 10, label: 'Vísceras', target: [-0.92, 0.95, -0.15], dir: [0, 0.15, -1], span: [1.2, 0.7], owners: ['abdomen'], hideLayers: ['pared', 'nervio', 'proyeccion', 'omento'], hide: ['rumen', 'reticulo', 'surco', 'omaso', 'abomaso', 'orificio', 'insula', 'pliegue_rum', 'om_', 'pa_', 'reg_', 'torus', 'esofago', 'tuberosidad', 'ultima'] },
});
for (const id of ['corte_t10', 'corte_t13', 'corte_l3', 'corte_l5']) VIEWS[id].p = 10;
// en P10 se ocultan las proyecciones torácicas de la P9 (áreas pulmonar/cardíaca, focos)
const P9_PROJ = ['proy_', 'lim_', 'aus_', 'area_', 'linea_receso', 'epidural'];
for (const v of Object.values(VIEWS)) if (v.p === 10) v.hide = [...(v.hide || []), ...P9_PROJ];
// las vistas laterales del abdomen no necesitan los pulmones tapando retículo, hígado y bazo
for (const id of ['abd_izq', 'abd_dcho', 'abd_omentos', 'paramediano']) VIEWS[id].hide.push('pulmon_', 'borde_basal_pulmon');
// ── Práctica 11 · pelvis, genitales, ubre y miembros ──
// En la P9/P10 no se muestran las partes blandas de los miembros ni el toro (módulos 'miembros' y 'toro').
const BASE_OWNERS = ['head', 'neck', 'thorax', 'body', 'abdomen', 'p11'];
for (const v of Object.values(VIEWS)) v.owners ??= BASE_OWNERS;
const FEM = ['fem_', 'vulva_', 'ubre_', 'perine', 'a_uterina', 'nnll_mamarios', 'a_pudenda_ext', 'v_pudenda_ext', 'exc_'];
const P11_HIDE = ['reg_', ...P9_PROJ];
const ALL_L = Object.keys(LAYERS);
const keepL = (...l) => ALL_L.filter((x) => !l.includes(x));     // hideLayers = todas menos estas
const p11v = (o) => ({ p: 11, skin: 0, ...o, hide: [...P11_HIDE, ...(o.hide || [])] });
const LIMB_ON = keepL('hueso', 'musculo', 'vaso', 'nervio', 'linfa');
Object.assign(VIEWS, {
  // pelvis y vísceras pélvicas (vaca)
  pelvis: p11v({ label: 'Pelvis', target: [-1.6, 1.06, 0], dir: [0.05, 0.12, 1], span: [0.78, 0.55], owners: ['p11', 'body'], hideLayers: keepL('hueso', 'proyeccion', 'musculo'), hide: ['toro_', 'lineas_art', ...FEM, 'ano'] }),
  pelvis_medidas: p11v({ label: 'Medidas pélvicas', target: [-1.62, 1.04, 0], dir: [0, 0.05, 1], span: [0.7, 0.45], owners: ['p11', 'body'], hideLayers: keepL('hueso', 'proyeccion'), clip: 'sag', clipPos: 0.004, hide: ['toro_', ...FEM, 'ano', 'lineas_art'] }),
  pelvis_craneal: p11v({ label: 'Abertura craneal', target: [-1.56, 1.04, 0], dir: [1, 0.3, 0.12], span: [0.5, 0.45], owners: ['p11', 'body'], hideLayers: keepL('hueso', 'proyeccion'), hide: ['toro_', ...FEM, 'ano', 'lineas_art', 'femur', 'trocanter', 'rotula'] }),
  perine: p11v({ label: 'Periné', target: [-1.93, 1.0, 0], dir: [-1, 0.15, 0.35], span: [0.5, 0.42], owners: ['p11', 'body'], hideLayers: keepL('hueso', 'proyeccion', 'piel'), hide: ['toro_', 'pel_', 'exc_'], skin: 0.5 }),
  visceras_pelv: p11v({ label: 'Vísceras pélvicas', target: [-1.63, 1.0, 0.02], dir: [0.1, 0.3, 1], span: [0.72, 0.42], owners: ['p11', 'abdomen'], hideLayers: keepL('hueso', 'viscera', 'omento', 'musculo', 'proyeccion', 'glandula'), hide: ['lineas_art', 'toro_', 'ubre_', 'pel_diam', 'pel_eje', 'pel_incl', 'pel_abertura', 'pel_linea', 'lig_sacro', 'rumen', 'reticulo', 'omaso', 'abomaso', 'om_', 'pa_', 'yeyuno', 'ileon', 'colon', 'ciego', 'duodeno', 'mesenterio', 'nnll_yey', 'higado', 'rinon', 'bazo', 'pancreas'] }),
  genitales: p11v({ label: 'Genitales ♀', target: [-1.6, 0.99, 0.02], dir: [0.05, 0.75, 0.6], span: [0.62, 0.36], owners: ['p11'], hideLayers: keepL('viscera', 'omento', 'vaso', 'proyeccion', 'linfa'), hide: ['toro_', 'rec_', 'ubre_', 'pel_', 'perine', 'ano', 'exc_', 'lineas_art', 'a_pudenda', 'v_pudenda', 'nnll_mamarios', 'nnll_inguinales'] }),
  genitales_int: p11v({ label: 'Interior ♀', target: [-1.68, 0.985, 0], dir: [0, 0.06, 1], span: [0.6, 0.28], owners: ['p11'], hideLayers: keepL('viscera', 'glandula', 'proyeccion', 'omento'), clip: 'sag', clipPos: 0.0015, hide: ['lineas_art', 'toro_', 'ubre_', 'pel_', 'perine', 'exc_', 'fem_mesometrio'] }),
  ovario: p11v({ label: 'Ovario', target: [-1.478, 0.968, 0.137], dir: [0.35, 0.5, 1], span: [0.13, 0.1], owners: ['p11'], hideLayers: keepL('viscera', 'omento', 'vaso'), hide: ['lineas_art', 'toro_', 'rec_', 'ubre_', 'fem_mesometrio'] }),
  exploracion: p11v({ label: 'Exploración rectal', target: [-1.4, 1.0, 0], dir: [-0.2, 1, 0.1], span: [0.95, 0.6], owners: ['p11', 'abdomen'], hideLayers: keepL('viscera', 'vaso', 'linfa', 'hueso', 'proyeccion'), hide: ['lineas_art', 'toro_', 'rec_', 'om_', 'pa_', 'pel_diam', 'pel_eje', 'pel_incl', 'pel_abertura', 'pel_linea', 'lig_sacro', 'ubre_', 'exc_', 'higado', 'vesicula', 'femur', 'trocanter', 'rotula', 'tib', 'v_cava', 'v_porta', 'recto'] }),
  ubre: p11v({ label: 'Ubre', target: [-1.52, 0.44, 0.04], dir: [0.25, 0.12, 1], span: [0.75, 0.6], owners: ['p11', 'body', 'abdomen'], hideLayers: keepL('glandula', 'vaso', 'linfa', 'musculo', 'piel', 'proyeccion'), hide: ['toro_', 'pel_', 'perine', 'ano', 'vulva', 'pa_obl', 'pa_trans', 'pa_recto', 'pa_vaina', 'pa_cutaneo', 'reg_'], skin: 0.12 }),
  ubre_corte: p11v({ label: 'Corte ubre', target: [-1.52, 0.42, 0.1], dir: [0, 0.05, 1], span: [0.62, 0.5], owners: ['p11'], hideLayers: keepL('glandula', 'vaso', 'linfa', 'musculo', 'proyeccion'), clip: 'sag', clipPos: 0.1, hide: ['toro_', 'pel_', 'm_', 'lig_', 'exc_', 'fem_', 'vulva', 'perine', 'ano', 'rec_', 'nnll_iliacos', 'a_iliaca', 'a_uterina', 'lineas_art'] }),
  // toro
  toro: p11v({ label: 'Toro', target: [-1.36, 0.72, 0], dir: [0, 0.08, 1], span: [1.15, 0.62], owners: ['toro', 'p11'], hideLayers: keepL('hueso', 'piel', 'viscera', 'glandula', 'vaso', 'musculo', 'omento', 'linfa'), hide: [...FEM, 'ano', 'pel_diam', 'pel_eje', 'pel_incl', 'pel_abertura', 'pel_linea', 'pel_agujero', 'rec_', 'lineas_art', 'esc_', 'hum', 'radio', 'rad_', 'cub', 'olecranon', 'carpo', 'metacarpo', 'mc_', 'esp_inter', 'sesamoideo', 'femur', 'trocanter', 'rotula', 'lig_rot', 'art_', 'tib', 'cabeza_perone', 'calcaneo', 'talo', 'centrocuartal', 'tarsiano', 'metatarso', 'sesamoideo', 'pez_', 'falange', 'fd_', 'ligg_', 'pie_'] }),
  toro_escroto: p11v({ label: 'Testículo', target: [-1.47, 0.5, 0.05], dir: [0.3, 0.12, 1], span: [0.32, 0.42], owners: ['toro'], hideLayers: [], hide: ['toro_escroto', 'toro_rafe', 'toro_pezones', 'toro_fascia_esp_ext'] }),
  toro_pelvico: p11v({ label: 'Genitales pélvicos ♂', target: [-1.62, 0.96, 0], dir: [-0.05, 1, 0.12], span: [0.5, 0.3], owners: ['toro', 'p11'], hideLayers: keepL('viscera', 'glandula', 'musculo', 'omento', 'hueso'), hide: [...FEM, 'rec_', 'm_', 'lig_', 'pel_ala', 'tuberosidad', 'pel_cuerpo', 'pel_sacro', 'femur', 'trocanter', 'art_'] }),
  toro_pene: p11v({ label: 'Pene', target: [-1.3, 0.69, 0], dir: [0, 0.05, 1], span: [1.25, 0.5], owners: ['toro'], hideLayers: keepL('viscera', 'musculo', 'piel', 'proyeccion', 'glandula'), hide: ['toro_escroto', 'toro_fascia', 'toro_tunica', 'toro_bolsa', 'toro_rafe_esc', 'toro_pezones'] }),
  // miembro torácico
  mt_esqueleto: p11v({ label: 'Esqueleto torácico', target: [0.2, 0.74, 0.2], dir: [0.15, 0.06, 1], span: [0.85, 1.5], owners: ['p11', 'body'], hideLayers: keepL('hueso') }),
  mt_hombro: p11v({ label: 'Hombro y brazo', target: [0.2, 0.98, 0.2], dir: [0.1, 0.12, 1], span: [1.0, 0.85], owners: ['p11', 'miembros', 'neck', 'body'], hideLayers: LIMB_ON }),
  mt_medial: p11v({ label: 'Brazo medial', target: [0.22, 0.95, 0.19], dir: [0.1, 0.08, -1], span: [0.85, 0.8], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, clip: 'sag', clipPos: 0.13, flip: true }),
  mt_antebrazo: p11v({ label: 'Antebrazo', target: [0.13, 0.55, 0.21], dir: [0.12, 0.05, 1], span: [0.36, 0.55], owners: ['p11', 'miembros'], hideLayers: LIMB_ON }),
  mt_antebrazo_med: p11v({ label: 'Antebrazo medial', target: [0.13, 0.55, 0.2], dir: [0.12, 0.05, -1], span: [0.36, 0.55], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, clip: 'sag', clipPos: 0.14, flip: true }),
  mt_carpo: p11v({ label: 'Carpo', target: [0.15, 0.33, 0.2], dir: [0.6, 0.15, 1], span: [0.17, 0.13], owners: ['p11'], hideLayers: keepL('hueso', 'proyeccion') }),
  mt_dedos: p11v({ label: 'Mano', target: [0.17, 0.15, 0.19], dir: [0.4, 0.12, 1], span: [0.24, 0.34], owners: ['p11', 'miembros'], hideLayers: keepL('hueso', 'musculo', 'vaso') }),
  pezuna: p11v({ label: 'Pezuña', target: [0.19, 0.045, 0.19], dir: [0.7, 0.3, 0.8], span: [0.2, 0.15], owners: ['p11'], hideLayers: keepL('piel', 'hueso') }),
  pezuna_suela: p11v({ label: 'Suela', target: [0.19, 0.0, 0.19], dir: [0.15, -1, 0.2], span: [0.2, 0.17], owners: ['p11'], hideLayers: keepL('piel') }),
  // miembro pelviano
  mp_esqueleto: p11v({ label: 'Esqueleto pelviano', target: [-1.6, 0.68, 0.2], dir: [0.1, 0.06, 1], span: [0.8, 1.42], owners: ['p11', 'body'], hideLayers: keepL('hueso'), hide: ['toro_'] }),
  mp_grupa: p11v({ label: 'Grupa y muslo', target: [-1.6, 0.92, 0.2], dir: [0, 0.1, 1], span: [0.85, 0.85], owners: ['p11', 'miembros', 'body'], hideLayers: LIMB_ON, hide: ['toro_', 'ubre_', 'lig_sacro'] }),
  mp_profundo: p11v({ label: 'Muslo profundo', target: [-1.62, 0.9, 0.2], dir: [0, 0.1, 1], span: [0.8, 0.8], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, hide: ['toro_', 'ubre_', 'lig_sacro', 'm_gluteobiceps', 'm_tensor', 'm_gluteo_medio', 'm_semitendinoso'] }),
  mp_medial: p11v({ label: 'Muslo medial', target: [-1.58, 0.85, 0.15], dir: [0.05, 0.05, -1], span: [0.75, 0.75], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, clip: 'sag', clipPos: 0.11, flip: true, hide: ['toro_', 'ubre_', 'lig_sacro'] }),
  mp_pierna: p11v({ label: 'Pierna', target: [-1.56, 0.48, 0.2], dir: [0, 0.05, 1], span: [0.42, 0.55], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, hide: ['toro_', 'ubre_', 'lig_sacro'] }),
  mp_pierna_med: p11v({ label: 'Pierna medial', target: [-1.56, 0.48, 0.18], dir: [0.05, 0.05, -1], span: [0.42, 0.55], owners: ['p11', 'miembros'], hideLayers: LIMB_ON, clip: 'sag', clipPos: 0.13, flip: true, hide: ['toro_', 'ubre_', 'lig_sacro'] }),
  mp_tarso: p11v({ label: 'Tarso', target: [-1.64, 0.33, 0.18], dir: [0.4, 0.1, 1], span: [0.16, 0.17], owners: ['p11'], hideLayers: keepL('hueso') }),
});
// las vistas que no son del toro ocultan sus estructuras
for (const [id, v] of Object.entries(VIEWS)) if (!id.startsWith('toro')) v.hide = [...(v.hide || []), 'toro_'];
const viewPose = (v) => {
  const t = new THREE.Vector3(...v.target);
  const p = t.clone().add(new THREE.Vector3(...v.dir).normalize().multiplyScalar(fitDistance(v.span)));
  return [p, t];
};
const viewsEl = $('views');
// selector de práctica: muestra los botones de vistas de la 9 o de la 10
const ptab = el('div', 'ptab');
ptab.innerHTML = '<button data-p="9">P9</button><button data-p="10">P10</button><button data-p="11">P11</button>';
viewsEl.appendChild(ptab);
let practice = 11;
function showPractice(p) {
  practice = p;
  ptab.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.p === p));
  viewsEl.querySelectorAll('button[data-view]').forEach((b) => { b.hidden = VIEWS[b.dataset.view].p !== p; });
}
ptab.onclick = (e) => { const p = e.target.dataset?.p; if (p) { showPractice(+p); viewsEl.scrollLeft = 0; } };
// rueda vertical → desplazamiento horizontal de la barra de vistas
viewsEl.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && viewsEl.scrollWidth > viewsEl.clientWidth) { viewsEl.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });
for (const [id, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.view = id;
  b.onclick = () => goView(id); viewsEl.appendChild(b);
}
showPractice(practice);
function goView(id, instant = false) {
  const v = VIEWS[id]; if (!v) return;
  if (v.p !== practice) showPractice(v.p);
  viewsEl.querySelectorAll('button[data-view]').forEach((b) => {
    const on = b.dataset.view === id;
    b.classList.toggle('on', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  sel.hidePrefix = v.hide || [];
  sel.owners = v.owners || null;
  const off = v.hideLayers ?? ['pared'];
  setLayers(v.layers || Object.keys(LAYERS).filter((l) => !off.includes(l)));
  clip.flip = !!v.flip;
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
// opacidad del resto del modelo durante el examen: casi invisible, pero deja intuir la silueta
const QUIZ_GHOST = 0.022;
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
    // el resto se vuelve casi invisible: solo destaca la pieza preguntada
    sel.refs = new Set(expand(quiz.target)); sel.isolate = true; sel.ghost = QUIZ_GHOST; applyVisibility(); frameRefs(sel.refs, { pad: 3.2 });
    const wrong = shuffle(pool.filter((r) => r !== quiz.target && NAME[r] !== NAME[quiz.target])).slice(0, 3);
    for (const r of shuffle([quiz.target, ...wrong])) {
      const b = el('button', 'opt'); b.textContent = NAME[r];
      b.onclick = () => answer(r === quiz.target, b);
      opts.appendChild(b);
    }
  } else {
    // «Encuéntrala»: hay que ver todo para poder hacer clic
    sel.refs = new Set(); sel.isolate = false; applyVisibility();
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
  if (quiz.mode === 'find') { sel.refs = new Set(expand(quiz.target)); sel.isolate = true; sel.ghost = QUIZ_GHOST; applyVisibility(); frameRefs(sel.refs, { pad: 3 }); }
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
  if (on) { if (openSub && quiz.scope === 'all') { scopeEl.value = openSub; quiz.scope = openSub; } quizNext(); }
  else { sel.isolate = $('isolate').checked; sel.ghost = null; clearSel(); }    // vuelve el aislado del usuario
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
goView(params.get('view') || 'abd_izq', true);
if (params.get('layers')) setLayers(params.get('layers').split(','));
if (params.get('skin')) { $('skin').value = params.get('skin'); setSkinOpacity(parseFloat(params.get('skin'))); }
if (params.get('clip')) { const [m, p] = params.get('clip').split(':'); applyClipUI(m, p !== undefined ? parseFloat(p) : undefined); if (params.has('flip')) setClip(clip.mode, clip.pos, true); }
if (params.get('cam')) camera.position.set(...params.get('cam').split(',').map(Number));
if (params.get('target')) controls.target.set(...params.get('target').split(',').map(Number));
if (params.has('quiz')) toggleQuiz(true);                 // ?quiz=1 abre el examen (pruebas y enlaces)
if (params.get('sel')) choose(params.get('sel'), {}, { focus: !params.get('cam') });
if (params.get('pins')) { const sub = SECTIONS.flatMap((s) => s.subs).find((s) => s.id === params.get('pins')); if (sub) { currentSub = sub; $('pins').checked = true; showPins(); } }
if (SHOT && params.get('ui') === '0') document.body.classList.add('noui');
if (!SHOT && !localStorage.getItem('vaca3d.help')) $('help').hidden = false;
applyVisibility();
$('loader').classList.add('done');
onFrame(() => {});
window.__vaca = { registry, allMeshes, camera, controls };
