// ─────────────────────────────────────────────────────────────
// neck/skeleton.js · Esqueleto cervical: C1 atlas, C2 axis, C3-C7,
// apófisis transversas, ligamento de la nuca y bolsa supraespinosa.
// Coordenadas MUNDO. +X craneal, +Y dorsal, +Z izquierda.
// ─────────────────────────────────────────────────────────────
import {
  THREE, V, blob, tube, loft, ring, lerp, makeMaterial, place,
} from '../../geo.js';
import {
  CERVICAL, THORACIC, THORACIC_SPINE_H, THORACIC_SPINE_TILT, headToWorld,
} from '../../frame.js';

const vadd = (p, dx, dy, dz = 0) => V(p.x + dx, p.y + dy, p.z + dz);

// Vector unitario craneal→caudal de la columna cervical en el índice i (0..6)
function axisDir(i) {
  const a = CERVICAL[Math.max(0, i - 1)];
  const b = CERVICAL[Math.min(6, i + 1)];
  return b.clone().sub(a).normalize();
}

// ── Cuerpo vertebral genérico (craneal convexo, fosa caudal) ──
function vertebralBody(c, len, r, dir) {
  const t = dir.clone();
  const p0 = c.clone().addScaledVector(t, len * 0.55);   // extremo craneal (cabeza)
  const p1 = c.clone().addScaledVector(t, -len * 0.55);  // extremo caudal (fosa)
  const body = loft(
    [p0, c.clone().addScaledVector(t, len * 0.1), p1],
    (u) => {
      // ensancha hacia los extremos ligeramente
      const w = r * (0.85 + 0.25 * Math.sin(u * Math.PI));
      return { w, h: r * 0.95, p: 2.4 };
    },
    'bone', { segs: 18, radial: 18, caps: true },
  );
  return body;
}

// Arco vertebral + apófisis espinosa; devuelve grupo (espinosa crece caudalmente)
function neuralArch(c, r, dir, spineH, spineBackTilt) {
  const g = new THREE.Group();
  const up = V(0, 1, 0);
  const dorsal = c.clone().addScaledVector(up, r * 1.35);
  // pedículos/arco: pequeño anillo dorsal al cuerpo
  const arch = blob(c.clone().addScaledVector(up, r * 0.95), [r * 0.55, r * 0.7, r * 0.95], 'bone2',
    { detail: 3, noise: 0.05 });
  g.add(arch);
  // apófisis espinosa (lámina que se inclina caudal)
  if (spineH > 0.004) {
    const back = dir.clone().multiplyScalar(-1);  // caudal
    const tip = dorsal.clone()
      .addScaledVector(up, spineH)
      .addScaledVector(back, spineH * spineBackTilt);
    const spine = loft(
      [dorsal, dorsal.clone().lerp(tip, 0.5), tip],
      (u) => ({ w: lerp(r * 0.12, r * 0.05, u), h: lerp(r * 0.5, r * 0.22, u), p: 2.2 }),
      'bone', { segs: 12, radial: 12, caps: true },
    );
    g.add(spine);
  }
  return g;
}

// Apófisis articulares craneales y caudales (pares) de una vértebra
function articularProcesses(c, r, dir) {
  const g = new THREE.Group();
  const up = V(0, 1, 0);
  const t = dir.clone();
  for (const s of [1, -1]) {           // lado izq/dcho
    for (const f of [1, -1]) {         // craneal/caudal
      const p = c.clone()
        .addScaledVector(up, r * 1.15)
        .addScaledVector(t, f * r * 0.55)
        .add(V(0, 0, s * r * 0.55));
      g.add(blob(p, [r * 0.3, r * 0.22, r * 0.28], 'bone2', { detail: 2, noise: 0.04 }));
    }
  }
  return g;
}

// Apófisis transversa de una vértebra cervical típica (C3-C5): tubérculos dorsal y ventral
function transverseProcess(c, r, dir, broadVentral = false) {
  const g = new THREE.Group();
  const t = dir.clone();
  const down = V(0, -1, 0);
  for (const s of [1, -1]) {
    const base = c.clone().add(V(0, 0, s * r * 0.5));
    // tubérculo dorsal (apófisis transversa propiamente, caudolateral)
    const dTip = base.clone().add(V(0, 0, s * r * 0.9)).addScaledVector(t, -r * 0.3).addScaledVector(down, r * 0.1);
    g.add(tube([base, base.clone().lerp(dTip, 0.5), dTip],
      (u) => lerp(r * 0.26, r * 0.12, u), 'bone', { radial: 8, segs: 8 }));
    // tubérculo/lámina ventral
    const vLen = broadVentral ? r * 1.4 : r * 0.85;
    const vTip = base.clone().add(V(0, 0, s * r * 0.55)).addScaledVector(down, vLen).addScaledVector(t, -r * 0.2);
    if (broadVentral) {
      // C6: lámina ventral ancha y aplanada
      const plate = loft(
        [base.clone().addScaledVector(t, r * 0.4), base.clone().addScaledVector(down, vLen * 0.6).add(V(0, 0, s * r * 0.3)), vTip],
        (u) => ({ w: lerp(r * 0.4, r * 0.55, u), h: lerp(r * 0.2, r * 0.06, u), p: 2.2 }),
        'bone', { segs: 10, radial: 12, caps: true, up: [0, 0, s] });
      g.add(plate);
    } else {
      g.add(tube([base, base.clone().lerp(vTip, 0.5), vTip],
        (u) => lerp(r * 0.24, r * 0.1, u), 'bone', { radial: 8, segs: 8 }));
    }
  }
  return g;
}

export function buildSkeleton() {
  const len = 0.095;

  // ── C3..C7 (índices 2..6) ──
  for (let i = 2; i <= 6; i++) {
    const c = CERVICAL[i];
    const dir = axisDir(i);
    const r = lerp(0.034, 0.045, (i - 2) / 4);       // engrosan hacia caudal
    const spineH = lerp(0.012, i === 6 ? 0.085 : 0.05, (i - 2) / 4); // C7 espina alta
    const g = new THREE.Group();
    g.add(vertebralBody(c, len, r, dir));
    g.add(neuralArch(c, r, dir, spineH, 0.35));
    g.add(articularProcesses(c, r, dir));
    place('vertebras_cervicales', g);
    // apófisis transversas como ref separada (C6 lámina ventral ancha)
    place('ap_transversas_cervicales', transverseProcess(c, r, dir, i === 5));
  }

  // ── C2 axis (índice 1): cuerpo largo, diente (dens), cresta espinosa alta y larga ──
  {
    const c = CERVICAL[1];
    const dir = axisDir(1);
    const t = dir.clone();
    const up = V(0, 1, 0);
    const g = new THREE.Group();
    const r = 0.036;
    g.add(vertebralBody(c, len * 1.25, r, dir));
    // diente (dens): proyección craneal del cuerpo hacia el atlas
    const dens0 = c.clone().addScaledVector(t, len * 0.62);
    const dens1 = c.clone().addScaledVector(t, len * 0.95);
    g.add(tube([dens0, dens1], (u) => lerp(r * 0.4, r * 0.22, u), 'bone', { radial: 10, segs: 8 }));
    // cresta espinosa alta y larga (lámina dorsal que recorre casi todo el cuerpo)
    const sp0 = c.clone().addScaledVector(up, r * 1.1).addScaledVector(t, len * 0.5);
    const sp1 = c.clone().addScaledVector(up, r * 1.1).addScaledVector(t, -len * 0.55);
    const crest = loft(
      [sp0, sp0.clone().lerp(sp1, 0.5).addScaledVector(up, 0.03), sp1.clone().addScaledVector(up, 0.01)],
      (u) => ({ w: 0.006, h: lerp(0.018, 0.034, Math.sin(u * Math.PI)), p: 2.1 }),
      'bone', { segs: 16, radial: 10, caps: true });
    g.add(crest);
    g.add(articularProcesses(c, r, dir));
    place('axis', g);
    place('ap_transversas_cervicales', transverseProcess(c, r, dir, false));
  }

  // ── C1 atlas (índice 0): cuerpo en anillo + alas anchas planas ──
  {
    const c = CERVICAL[0];
    const dir = axisDir(0);
    const t = dir.clone();
    const r = 0.04;
    // anillo del atlas (arcos dorsal y ventral): toro grueso, eje alineado con la columna
    const ringGeo = new THREE.TorusGeometry(r * 0.92, r * 0.26, 12, 28);
    ringGeo.computeVertexNormals();
    const bodyRing = new THREE.Mesh(ringGeo, makeMaterial('bone'));
    bodyRing.quaternion.setFromUnitVectors(V(0, 0, 1), t.clone().normalize());
    bodyRing.position.copy(c);
    place('atlas', bodyRing);

    // Alas del atlas: láminas anchas, planas, dirigidas lateral y ligeramente caudoventral
    const down = V(0, -1, 0);
    for (const s of [1, -1]) {
      const root = c.clone().add(V(0, 0, s * r * 0.5));
      const wingTip = root.clone().add(V(0, 0, s * 0.075)).addScaledVector(t, -0.02).addScaledVector(down, 0.012);
      const wing = loft(
        [root, root.clone().lerp(wingTip, 0.5), wingTip],
        (u) => ({ w: lerp(0.03, 0.045, u), h: lerp(0.016, 0.006, u), p: 2.2 }),
        'bone', { segs: 12, radial: 14, caps: true, up: [0, 0, s] });
      // ala_atlas es ref separada (palpable)
      place('ala_atlas', wing);
      // agujero alar: en rumiantes no es un foramen cerrado; se marca su posición en el ala
      const alarPos = root.clone().add(V(0, 0, s * 0.03)).addScaledVector(down, 0.004);
      place('ag_alar', ring(alarPos, V(0, 1, 0.1 * s), 0.006, 0.0022, 'marker', '#c9b25a'));
    }
  }

  buildNuchalLigament();
  buildSupraspinousBursa();
}

// ── Ligamento de la nuca: cordón funicular + láminas ──
function nuchalCordPath() {
  // Desde la protuberancia occipital externa (cabeza local -0.02,0.07,0) a las espinosas de la cruz (T2-T3)
  const occ = headToWorld(-0.02, 0.07, 0);
  const t2 = THORACIC[1], t3 = THORACIC[2];
  const spine = (i) => {
    const d = THORACIC[i], h = THORACIC_SPINE_H[i], tilt = THORACIC_SPINE_TILT[i];
    return V(d.x - Math.sin(tilt) * h, d.y + Math.cos(tilt) * h, 0);
  };
  const withers = spine(1).lerp(spine(2), 0.4);
  return [
    occ,
    V(0.92, 1.33, 0),
    V(0.78, 1.30, 0),
    V(0.62, 1.27, 0),
    V(0.46, 1.26, 0),
    V(0.34, 1.28, 0),
    withers,
  ];
}

// Color y acabado del tejido elástico (ligamento de la nuca): amarillento,
// semitransparente. El preset 'ligament' de geo.js es beige opaco, así que
// lo sobreescribimos por malla.
const NUCHAL_CORD_MAT = { color: '#d9c766', roughness: 0.5, clearcoat: 0.25 };
const NUCHAL_LAMINA_MAT = {
  color: '#e2d27a', roughness: 0.5, clearcoat: 0.2,
  transparent: true, opacity: 0.5, depthWrite: false, side: 2, // THREE.DoubleSide
};

function buildNuchalLigament() {
  const path = nuchalCordPath();
  // Cordón par (funicular): dos cuerdas ligeramente separadas en Z
  for (const s of [1, -1]) {
    const cord = path.map((p) => V(p.x, p.y, p.z + s * 0.011));
    place('cordon_nuca', tube(cord, (u) => lerp(0.011, 0.016, u), 'ligament',
      { radial: 10, mat: NUCHAL_CORD_MAT }));
  }

  // Láminas: lámina desde el cordón hacia las espinosas de C2-C7
  const spinesTargets = [];
  // C2 (axis) espinosa alta
  {
    const c = CERVICAL[1]; spinesTargets.push(V(c.x, c.y + 0.07, 0));
  }
  for (let i = 2; i <= 6; i++) {
    const c = CERVICAL[i];
    const h = lerp(0.03, i === 6 ? 0.09 : 0.055, (i - 2) / 4);
    spinesTargets.push(V(c.x, c.y + h, 0));
  }
  // superficie laminar: para cada tramo, un cuadrilátero del cordón a la espinosa
  const cordAtX = (x) => {
    // interpola la curva del cordón a esa x
    for (let k = 0; k < path.length - 1; k++) {
      const a = path[k], b = path[k + 1];
      if ((x <= a.x && x >= b.x) || (x >= a.x && x <= b.x)) {
        const tt = (a.x - x) / (a.x - b.x);
        return V(x, lerp(a.y, b.y, tt), 0);
      }
    }
    return path[path.length - 1].clone();
  };
  for (const target of spinesTargets) {
    const top = cordAtX(target.x);
    // lámina triangular vertical (muy fina) entre el cordón (arriba) y la espinosa (abajo)
    const g = sheetBetween(top, target, 0.0012);
    place('laminas_nuca', g);
  }
}

// Lámina fina en el plano sagital entre el cordón (arriba) y la espinosa (abajo).
// La curva va vertical (Y); con up=[1,0,0] el eje B≈X y N≈Z, así que
// w = ancho craneocaudal de la hoja y h = semigrosor medio-lateral (muy fino).
function sheetBetween(top, bot, halfThickZ) {
  const pts = [top, top.clone().lerp(bot, 0.5), bot];
  return loft(pts, (u) => ({ w: lerp(0.016, 0.01, u), h: halfThickZ, p: 2 }),
    'ligament', { segs: 8, radial: 8, caps: true, up: [1, 0, 0], mat: NUCHAL_LAMINA_MAT });
}

function buildSupraspinousBursa() {
  // Bolsa sinovial bajo el cordón de la nuca a nivel de T1-T2 (cruz)
  const d = THORACIC[1], h = THORACIC_SPINE_H[1], tilt = THORACIC_SPINE_TILT[1];
  const tip = V(d.x - Math.sin(tilt) * h, d.y + Math.cos(tilt) * h, 0);
  const pos = tip.clone().add(V(0.02, -0.02, 0));
  place('bolsa_supraespinosa', blob(pos, [0.022, 0.016, 0.02], 'cartilage',
    { detail: 3, noise: 0.08, mat: { transparent: true, opacity: 0.6, depthWrite: false } }));
}

export { vadd };
