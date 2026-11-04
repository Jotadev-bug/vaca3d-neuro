// ─────────────────────────────────────────────────────────────
// neck/skin.js · Faneros cutáneos del cuello: papada (pliegue ventral
// en el plano medio) y mamellas (apéndices colgantes craneoventrales).
// ─────────────────────────────────────────────────────────────
import { THREE, V, blob, place, makeMaterial } from '../../geo.js';
import { NECK_DEWLAP, NECK_SKIN } from '../../frame.js';

// Centro/semiejes de la piel del cuello a una x (duplicado local mínimo)
function neckSkinAt(x) {
  const s = NECK_SKIN;
  if (x >= s[0].c.x) return s[0];
  if (x <= s[s.length - 1].c.x) return s[s.length - 1];
  for (let k = 0; k < s.length - 1; k++) {
    const a = s[k], b = s[k + 1];
    if (x <= a.c.x && x >= b.c.x) {
      const t = (a.c.x - x) / (a.c.x - b.c.x);
      return { c: V(x, a.c.y + (b.c.y - a.c.y) * t), h: a.h + (b.h - a.h) * t, w: a.w + (b.w - a.w) * t };
    }
  }
  return s[s.length - 1];
}
// Borde ventral de la piel del cuello (z=0) a una x
function ventralSkinY(x) {
  const sk = neckSkinAt(x);
  return sk.c.y - sk.h;   // superelipse: punto más ventral
}

export function buildSkin() {
  buildDewlap();
  buildMamellae();
}

// ── Papada: lámina cutánea colgante en el plano medio, más gruesa en el borde libre ──
function buildDewlap() {
  // malla manual: fila superior = unión con la piel ventral del cuello; fila inferior = borde libre (NECK_DEWLAP)
  const free = NECK_DEWLAP.map((p) => p.clone());
  const nSeg = free.length - 1;
  const nv = 6;         // subdivisiones verticales
  const thick = 0.012;  // grosor en z (más en el borde libre)
  const pos = [], idx = [];
  // construimos una superficie doble (dos caras) con grosor variable
  const rows = [];
  for (let j = 0; j <= nv; j++) rows.push([]);
  for (let i = 0; i <= nSeg; i++) {
    const low = free[i];
    const topY = ventralSkinY(low.x) + 0.004;  // se une 4 mm por encima del borde ventral
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;                 // 0 arriba (unión) .. 1 abajo (borde libre)
      const y = topY + (low.y - topY) * t;
      // grosor: fino arriba, más grueso en el borde libre
      const halfZ = (0.002 + thick * t * t) * 0.5;
      rows[j].push({ x: low.x, y, z: halfZ });
    }
  }
  const index = (i, j, s) => s * (nSeg + 1) * (nv + 1) + j * (nSeg + 1) + i;
  for (const s of [0, 1]) {
    const sign = s === 0 ? 1 : -1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nSeg; i++) {
      const r = rows[j][i];
      pos.push(r.x, r.y, sign * r.z);
    }
  }
  for (const s of [0, 1]) {
    for (let j = 0; j < nv; j++) for (let i = 0; i < nSeg; i++) {
      const a = index(i, j, s), b = index(i + 1, j, s), c = index(i, j + 1, s), d = index(i + 1, j + 1, s);
      if (s === 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  // cerrar el borde libre inferior (une cara izq y dcha)
  for (let i = 0; i < nSeg; i++) {
    const a = index(i, nv, 0), b = index(i + 1, nv, 0), c = index(i, nv, 1), d = index(i + 1, nv, 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, makeSkinMat());
  place('papada', m, 'piel');
}

function makeSkinMat() {
  return makeMaterial('skin', { color: '#e7d2bd', opacity: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide });
}

// ── Mamellas: dos apéndices cutáneos en forma de lágrima, ventral craneal del cuello ──
function buildMamellae() {
  const baseX = 0.86;    // craneal
  const sk = neckSkinAt(baseX);
  const y0 = sk.c.y - sk.h + 0.01;
  for (const side of [1, -1]) {
    const pos = V(baseX, y0 - 0.03, side * 0.02);
    const drop = blob(pos, [0.012, 0.03, 0.01], 'skin',
      { detail: 3, noise: 0.08, mat: { color: '#e7d2bd', opacity: 0.85, transparent: true, depthWrite: true },
        deform: (v) => { v.y -= Math.max(0, v.y) * 0.4; } });  // afina hacia arriba (lágrima)
    place('mamellas', drop, 'piel');
  }
}
