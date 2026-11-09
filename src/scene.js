// scene.js · render, cámara, luces, selección, cortes y etiquetas
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { root, allMeshes, registry } from './geo.js';

export const canvas = document.getElementById('scene');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = false;
renderer.setClearColor(0x000000, 0);

export const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;

const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 4, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.6); rim.position.set(-3, 2, -2); scene.add(rim);
const hemi = new THREE.HemisphereLight(0xffffff, 0xd9dee8, 0.5);
scene.add(hemi);

// sombra de contacto suave (textura radial en canvas)
let shadowMat;
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(40,50,70,0.28)'); grd.addColorStop(1, 'rgba(40,50,70,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(-0.4, 0.002, 0);
  scene.add(shadow);
}
scene.add(root);

/** Ajusta luces y sombra al tema de la interfaz (el fondo lo pinta el CSS). */
export function setTheme(dark) {
  hemi.groundColor.set(dark ? 0x3a4256 : 0xd9dee8);
  hemi.intensity = dark ? 0.65 : 0.5;
  scene.environmentIntensity = dark ? 0.95 : 0.85;
  shadowMat.color.set(dark ? 0x000000 : 0xffffff);
  skinK = dark ? 0.45 : 1;
  applyVisibility();
}

export const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
camera.position.set(0.6, 1.6, 4.2);
export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(-0.3, 0.95, 0);
controls.minDistance = 0.15; controls.maxDistance = 9;
controls.zoomToCursor = true;

// ── post-procesado: contorno de selección ──
const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
export const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
export const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
outline.edgeStrength = 4; outline.edgeGlow = 0.4; outline.edgeThickness = 1.2;
outline.visibleEdgeColor.set('#ff2d55'); outline.hiddenEdgeColor.set('#ff8fa6');
composer.addPass(outline);
composer.addPass(new OutputPass());

// Zona libre entre paneles: el centro óptico se desplaza ahí (setViewOffset)
export const free = { frac: 1, shift: 0 };
export function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h;
  const side = document.getElementById('sidebar'), tools = document.getElementById('tools');
  let l = 0, r = w;
  if (w > 900) {
    if (side && side.offsetParent !== null) l = side.getBoundingClientRect().right;
    if (tools && tools.offsetParent !== null) r = tools.getBoundingClientRect().left;
  }
  free.frac = Math.max(0.35, (r - l) / w);
  free.shift = (l + r) / 2 - w / 2;
  if (Math.abs(free.shift) > 1) camera.setViewOffset(w, h, -free.shift, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ── capas ──
export const layerState = {};
export let skinOpacity = 0.16;
// en oscuro la piel clara tapa más sobre el fondo: se atenúa
let skinK = 1;
export function setSkinOpacity(v) { skinOpacity = v; applyVisibility(); }

// ── corte ──
export const clip = { mode: 'none', pos: 0, flip: false, plane: new THREE.Plane() };
const CLIP_DEF = {
  sag: { n: new THREE.Vector3(0, 0, -1), range: [-0.45, 0.45], def: 0 },
  tr: { n: new THREE.Vector3(-1, 0, 0), range: [-2.0, 1.7], def: 0.05 },
  dor: { n: new THREE.Vector3(0, -1, 0), range: [0.3, 1.5], def: 0.95 },
};
export function clipRange(mode) { return CLIP_DEF[mode]?.range; }
export function clipDefault(mode) { return CLIP_DEF[mode]?.def ?? 0; }
export function setClip(mode, pos = clip.pos, flip = clip.flip) {
  clip.mode = mode; clip.pos = pos; clip.flip = flip;
  if (mode === 'none') { renderer.clippingPlanes = []; }
  else {
    const n = CLIP_DEF[mode].n.clone().multiplyScalar(flip ? -1 : 1);
    // conserva puntos con n·p + c >= 0
    clip.plane.set(n, -n.dot(new THREE.Vector3(mode === 'tr' ? pos : 0, mode === 'dor' ? pos : 0, mode === 'sag' ? pos : 0)));
    renderer.clippingPlanes = [clip.plane];
  }
  // con corte se ven las caras internas (aspecto de sección)
  for (const m of allMeshes) {
    const mat = m.material;
    if (mat.userData.baseSide === undefined) mat.userData.baseSide = mat.side;
    mat.side = mode === 'none' ? mat.userData.baseSide : THREE.DoubleSide;
    mat.needsUpdate = true;
  }
}

// ── selección / visibilidad ──
// hidePrefix: refs ocultas por la vista actual (p. ej. pulmones en «Corazón»)
// owners: si no es null, solo se ven las mallas de esos módulos (p. ej. «Corte cabeza»)
// ghost: opacidad del resto al aislar (null → 0.06; el examen usa menos)
export const sel = { refs: new Set(), isolate: false, ghost: null, quizHide: false, hidePrefix: [], owners: null };
export function selectedMeshes() {
  const out = [];
  for (const r of sel.refs) for (const o of registry.get(r) || []) o.traverse((m) => m.isMesh && out.push(m));
  return out;
}
const SEL_EMISSIVE = new THREE.Color('#ff2d55');
export function applyVisibility() {
  const selSet = new Set(selectedMeshes());
  for (const m of allMeshes) {
    const isSel = selSet.has(m);
    const hidden = sel.hidePrefix.some((p) => m.userData.ref?.startsWith(p))
      || (sel.owners && !sel.owners.includes(m.userData.owner));
    const layerOn = layerState[m.userData.layer] !== false && !hidden;
    m.visible = layerOn || isSel;
    const mat = m.material;
    const baseO = m.userData.layer === 'piel' && mat.userData.baseTransparent ? skinOpacity * skinK : mat.userData.baseOpacity;
    let o = baseO, tr = mat.userData.baseTransparent;
    if (sel.isolate && selSet.size && !isSel) {
      o = Math.min(baseO, sel.ghost ?? 0.06); tr = true;
      // modo examen: solo piel y huesos quedan como silueta; el resto se oculta (si no, las capas se suman)
      if (sel.ghost != null && m.userData.layer !== 'piel' && m.userData.layer !== 'hueso') m.visible = false;
      if (sel.ghost != null && m.userData.layer === 'piel') o = sel.ghost * 0.3;     // la piel tiene varias capas: más tenue
    }
    if (m.userData.layer === 'piel' && mat.userData.baseTransparent && skinOpacity <= 0.001 && !isSel) m.visible = false;
    mat.opacity = o; mat.transparent = tr;
    mat.depthWrite = tr ? (o > 0.5 && mat.userData.baseTransparent === false) : true;
    if (mat.emissive && mat.userData.baseEmissive != null) {
      // material.clone() (espejos) serializa userData: el Color llega como número hex
      const be = mat.userData.baseEmissive;
      if (!be.isColor) mat.userData.baseEmissive = new THREE.Color(typeof be === 'number' ? be : (be.r !== undefined ? new THREE.Color(be.r, be.g, be.b) : 0));
      mat.emissive.copy(isSel ? SEL_EMISSIVE : mat.userData.baseEmissive);
      mat.emissiveIntensity = isSel ? 0.35 : 1;
    }
  }
  outline.selectedObjects = [...selSet];
}

// ── picking ──
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function pick(clientX, clientY, { includeSkin = false } = {}) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const cands = allMeshes.filter((m) => m.visible && m.userData.ref && (includeSkin || m.userData.layer !== 'piel' || m.material.opacity > 0.5) && m.material.opacity > 0.1);
  const hits = ray.intersectObjects(cands, false);
  for (const h of hits) {
    if (clip.mode !== 'none' && clip.plane.distanceToPoint(h.point) < 0) continue;
    return h;
  }
  return null;
}

// ── encuadre animado ──
let tween = null;
export function frameBox(box, { dir, pad = 1.6, duration = 900 } = {}) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const d = Math.max(0.28, size * pad / (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.min(1, camera.aspect * free.frac));
  const vdir = (dir ? dir.clone() : camera.position.clone().sub(controls.target)).normalize();
  flyTo(c.clone().add(vdir.multiplyScalar(d)), c, duration);
}
/** Distancia para que un área de span=[ancho, alto] m quepa en la zona libre. */
export function fitDistance([sw, sh], margin = 1.1) {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  return Math.max(sh / (2 * t), sw / (2 * t * camera.aspect * free.frac)) * margin;
}
export function flyTo(pos, target, duration = 900) {
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), duration };
}
export function frameRefs(refs, opts) {
  const b = new THREE.Box3();
  for (const r of refs) for (const o of registry.get(r) || []) b.expandByObject(o);
  frameBox(b, opts);
}

// ── etiquetas numéradas (pins) ──
const labelsEl = document.getElementById('labels');
let pins = [];
const tmp = new THREE.Vector3();
/** Punto de anclaje: vértice de la malla más cercano al centro de su caja. */
export function anchorOf(ref) {
  const objs = registry.get(ref); if (!objs?.length) return null;
  // usa el primer objeto del lado izquierdo (z>=0) si existe
  let best = null, bestScore = Infinity;
  for (const o of objs) {
    const b = new THREE.Box3().expandByObject(o);
    const c = b.getCenter(new THREE.Vector3());
    o.traverse((m) => {
      if (!m.isMesh) return;
      const p = m.geometry.attributes.position;
      const step = Math.max(1, Math.floor(p.count / 400));
      for (let i = 0; i < p.count; i += step) {
        tmp.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        const s = tmp.distanceToSquared(c) - (tmp.z > 0 ? 0.002 : 0) - tmp.z * 0.01;
        if (s < bestScore) { bestScore = s; best = tmp.clone(); }
      }
    });
  }
  return best;
}
export function setPins(list) {
  labelsEl.innerHTML = ''; pins = [];
  for (const { ref, n, name } of list) {
    const p = anchorOf(ref); if (!p) continue;
    const el = document.createElement('button');
    el.className = 'pin'; el.textContent = n; el.title = name;
    el.dataset.ref = ref;
    labelsEl.appendChild(el);
    pins.push({ el, p, ref });
  }
  return pins;
}
function updatePins() {
  if (!pins.length) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const pin of pins) {
    tmp.copy(pin.p).project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && (clip.mode === 'none' || clip.plane.distanceToPoint(pin.p) >= -0.002);
    pin.el.style.display = vis ? '' : 'none';
    pin.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
  }
}

// ── bucle ──
const listeners = [];
export function onFrame(fn) { listeners.push(fn); }
export function start() {
  resize();
  renderer.setAnimationLoop((t) => {
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.start) / tween.duration);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (k >= 1) tween = null;
    }
    controls.update();
    listeners.forEach((f) => f(t));
    composer.render();
    updatePins();
  });
}
