// ─────────────────────────────────────────────────────────────
// head.js · Módulo CABEZA del vacuno (owner 'head')
// Marco LOCAL de la cabeza: +x rostral (0 = cóndilos occipitales,
// 0.52 = hocico), +y dorsal, +z izquierda. Todo se cuelga de H.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import {
  root, place, both, tube, blob, loft, sheet, patch, marker, ring,
  pathLine, area, group, lerp, makeMaterial,
} from '../geo.js';
import { makeHeadGroup, SKULL, MANDIBLE, PHARYNX } from '../frame.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

export function build() {
  const H = makeHeadGroup();
  root.add(H);

  // Atajos de colocación en el marco de la cabeza.
  const P = (ref, obj, layer) => place(ref, obj, layer, H);
  // B = coloca la pieza (lado izq, +z) y su espejo DERECHO. En lugar de
  // both()/mirrorZ (que espeja con scale.z<0 e invierte las normales, dejando
  // el lado derecho en negro en tubos finos), horneamos el espejo en la
  // geometría: negamos z de cada vértice y recomputamos normales, con escala
  // positiva. Así el lado derecho tiene normales correctas y se ilumina bien.
  const B = (ref, obj, layer) => {
    place(ref, obj, layer, H);
    const m = mirrorBaked(obj);
    place(ref, m, layer, H);
    return [obj, m];
  };

  buildSkull(P, B);
  buildMandibleAndTeeth(P, B);
  buildHyoid(P, B);
  buildHorns(P, B);
  buildSinuses(P, B);
  buildNasalCavity(P, B);
  buildMouth(P, B);
  buildPharynxLarynx(P, B);
  buildSuperficial(P, B);
  buildExternal(P, B);
  buildSmallRuminant(P, B);

  // Caras finas (tubos, láminas) se ven de ambos lados; DoubleSide evita que
  // el back-face culling las deje negras al mirarlas desde el lado contrario.
  // Se fija en userData.baseSide para que scene.js lo respete (no lo resetee).
  H.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material.side = THREE.DoubleSide;
    o.material.userData.baseSide = THREE.DoubleSide;
  });
}

// Espejo DERECHO con normales correctas: clona, hornea z→−z en la geometría
// (invirtiendo el orden de los índices para conservar el sentido de las caras)
// y recomputa normales. Escala positiva ⇒ sin oscurecimiento del lado espejado.
function mirrorBaked(obj) {
  const c = obj.clone(true);
  c.traverse((o) => {
    // Reflejar la transformación local de CADA nodo (posición z y rotaciones
    // x,y): compuestas, equivalen a la reflexión z→−z de toda la jerarquía.
    o.position.z = -o.position.z;
    o.rotation.x = -o.rotation.x;
    o.rotation.y = -o.rotation.y;
    if (!o.isMesh) return;
    o.material = o.material.clone();
    const g = o.geometry.clone();
    // Reflexión z→−z de posiciones y normales. Al reflejar también la normal
    // (en vez de recomputar), se conserva la orientación correcta de cada cara
    // sin depender del winding, para tubos y sólidos por igual.
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, -pos.getZ(i));
    pos.needsUpdate = true;
    let nrm = g.attributes.normal;
    if (!nrm) { g.computeVertexNormals(); nrm = g.attributes.normal; }
    for (let i = 0; i < nrm.count; i++) nrm.setZ(i, -nrm.getZ(i));
    nrm.needsUpdate = true;
    // NO se invierte el winding: al reflejar las normales directamente, las
    // caras quedan bien orientadas con DoubleSide (combinar ambos las voltearía).
    o.geometry = g;
  });
  return c;
}

// ─────────────────────────────────────────────────────────────
// 1 · CRÁNEO (neurocráneo, frontal, occipital, cara ósea de contexto)
// ─────────────────────────────────────────────────────────────
function buildSkull(P, B) {
  const hw = SKULL.halfWidth, top = SKULL.top, pal = SKULL.palate;

  // ── Neurocráneo (caja craneal, occipital/temporal/base): x -0.03..0.09
  // Volumen redondeado y continuo que empalma con la cara ósea rostral.
  const neuro = loft(
    [V(-0.035, 0.02, 0), V(0.0, 0.035, 0), V(0.045, 0.04, 0), V(0.09, 0.03, 0), V(0.14, 0.015, 0)],
    (t) => {
      const x = lerp(-0.035, 0.14, t);
      const hTop = top(x), hBot = -0.05 + 0.02 * t;
      const h = (hTop - hBot) / 2;
      const dy = (hTop + hBot) / 2;
      const w = hw(x) * 0.92;
      return { w, h, p: 2.6, dy };
    },
    'bone', { segs: 32, radial: 30 },
  );
  P('craneo', neuro, 'hueso');

  // Cara occipital (nuca) + protuberancia occipital + línea de la nuca
  const occ = blob(V(-0.035, 0.035, 0), [0.03, 0.07, 0.085], 'bone2',
    { noise: 0.05, detail: 3, deform: (v) => { if (v.x < 0) v.x *= 1.1; } });
  P('craneo', occ, 'hueso');

  // ── Hueso frontal: FRENTE ANCHA Y PLANA (poll del vacuno), de la nuca
  // hasta entre las órbitas; lleva las bases de los cuernos. Techo casi liso.
  const frontal = loft(
    [V(-0.015, 0.0, 0), V(0.03, 0.0, 0), V(0.08, 0.0, 0), V(0.125, 0.0, 0), V(0.17, 0.0, 0)],
    (t) => {
      const x = lerp(-0.015, 0.17, t);
      // frente ancha: casi todo el semiancho del cráneo, bordes bien marcados
      const w = hw(x) * 1.02;
      const h = 0.014 + 0.004 * Math.sin(t * Math.PI);
      const dy = top(x) - h * 0.6;   // cara superior ≈ techo del cráneo (plano)
      return { w, h, p: 3.6, dy, wTop: w, wBot: w * 0.7 };
    },
    'bone', { segs: 32, radial: 28 },
  );
  P('h_frontal', frontal, 'hueso');

  // Cresta facial (relieve que baja desde la órbita sobre los molares, propio del buey)
  B('h_frontal', tube(
    [V(0.16, -0.01, 0.1), V(0.22, -0.02, 0.098), V(0.28, -0.03, 0.092)],
    0.006, 'bone2', { radial: 10 }), 'hueso');

  // Protuberancia intercornual (cresta transversal entre cuernos, punto más alto)
  const inter = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.15, 6, 14),
    frontalBoneMat(),
  );
  inter.rotation.x = Math.PI / 2;      // eje a lo largo de z
  inter.position.set(SKULL.intercornual.x, SKULL.intercornual.y - 0.004, 0);
  P('prot_intercornual', inter, 'hueso');

  // Línea de la nuca (borde caudal del techo). Capa 'proyeccion': es un relieve
  // de SUPERFICIE lateral, no una estructura de sección; en el corte sagital
  // se proyectaría como una línea suelta, así que no entra en la lámina.
  P('linea_nuca', pathLine(
    [V(-0.028, 0.085, 0.07), V(-0.02, 0.1, 0.035), V(-0.012, 0.108, 0),
      V(-0.02, 0.1, -0.035), V(-0.028, 0.085, -0.07)],
    'projection2', 0.003, { radial: 8 }), 'proyeccion');

  // Protuberancia occipital externa (línea media de la nuca)
  P('prot_occipital', marker(V(-0.03, 0.06, 0), '#d8caa8', 0.011, 'bone2'), 'hueso');

  // Apófisis estiloidea del temporal (caudoventral)
  B('ap_estiloidea', elong(V(0.015, -0.03, 0.065), V(0.0, -0.055, 0.05), 0.007, 'bone2'), 'hueso');

  // Fosa temporal (depresión lateral, caudal a órbita) y línea temporal (cresta dorsal)
  B('fosa_temporal', blob(SKULL.temporalFossa, [0.035, 0.04, 0.012], 'bone2',
    { noise: 0.04, detail: 3, deform: (v) => { v.z = v.z * 0.5 - 0.004; } }), 'hueso');
  B('linea_temporal', pathLine(
    [V(0.045, 0.07, 0.06), V(0.085, 0.06, 0.082), V(0.13, 0.04, 0.092), SKULL.orbit.clone().add(V(-0.01, 0.03, 0))],
    'projection2', 0.003, { radial: 8 }), 'proyeccion');

  // Apófisis cigomática del frontal (cierra la órbita por caudal) + arco cigomático + h. cigomático
  B('ap_cigomatica_frontal', elong(V(0.14, 0.03, 0.088), V(0.155, -0.015, 0.1), 0.008, 'bone'), 'hueso');
  B('arco_cigomatico', tube(SKULL.zygArch, 0.009, 'bone', { radial: 12 }), 'hueso');
  B('h_cigomatico', tube([SKULL.zygArch[2], V(0.19, -0.02, 0.1), V(0.21, -0.01, 0.092)], 0.008, 'bone2', { radial: 10 }), 'hueso');

  // Órbita (reborde óseo completo) + globo ocular detallado + bulla lagrimal
  B('craneo', orbitRim(SKULL.orbit, SKULL.orbitR), 'hueso');
  B(null, eyeball(SKULL.orbit), 'piel');
  B('bulla_lagrimal', blob(SKULL.lacrimalBulla, [0.013, 0.011, 0.009], 'bone2', { noise: 0.03, detail: 3 }), 'hueso');

  // Agujeros de la base / fondo de órbita como anillos. Capa 'proyeccion':
  // son marcas de superficie ósea; en el corte sagital flotan como aros
  // dorados sueltos, de modo que quedan fuera de la lámina de sección.
  B('ag_orbitorredondo', ring(V(0.055, -0.01, 0.045), V(0.4, -0.1, 1), 0.006, 0.0018, 'marker', '#caa24a'), 'proyeccion');
  B('ag_oval', ring(V(0.03, -0.02, 0.04), V(0.2, -0.3, 1), 0.005, 0.0016, 'marker', '#caa24a'), 'proyeccion');

  // ── Cara ósea: maxilar/nasal/lacrimal (x 0.13..0.5), continua con el
  // neurocráneo por caudal y afinándose hacia el hueso incisivo rostral.
  const face = loft(
    [V(0.13, 0.0, 0), V(0.2, -0.008, 0), V(0.28, -0.015, 0), V(0.36, -0.022, 0), V(0.44, -0.035, 0), V(0.5, -0.055, 0)],
    (t) => {
      const x = lerp(0.13, 0.5, t);
      const w = hw(x) * 0.94;
      const hTop = top(x), hPal = pal(x);
      const h = (hTop - hPal) / 2;
      const dy = (hTop + hPal) / 2;
      return { w, h, p: 2.7, dy };
    },
    'bone', { segs: 36, radial: 28 },
  );
  P(null, face, 'hueso');

  // Huesos nasales (dorso de la cara, par, leve relieve medio)
  P(null, loft(
    [V(0.2, 0.0, 0), V(0.3, -0.004, 0), V(0.4, -0.01, 0), V(0.47, -0.02, 0)],
    (t) => { const x = lerp(0.2, 0.47, t); return { w: hw(x) * 0.55, h: 0.01, p: 2.2, dy: top(x) - 0.006 }; },
    'bone2', { segs: 24, radial: 20 }), 'hueso');

  // Tuberosidad facial (relieve sobre M superiores)
  B('tub_facial', blob(SKULL.facialTuber, [0.016, 0.012, 0.01], 'bone2', { noise: 0.05, detail: 3 }), 'hueso');

  // Hueso incisivo (premaxilar edéntulo)
  B('h_incisivo', blob(SKULL.incisivePremax.clone().add(V(0, 0.01, 0)), [0.025, 0.016, 0.02], 'bone2',
    { noise: 0.04, detail: 3 }), 'hueso');

  // Escotadura nasoincisiva (línea borde de abertura nasal ósea) — proyección de superficie
  P('escotadura_nasoincisiva', pathLine(
    [V(0.47, 0.01, 0.0), V(0.44, -0.01, 0.02), V(0.425, -0.03, 0.03)],
    'projection2', 0.0035, { radial: 8 }), 'proyeccion');

  // Surco supraorbitario + canal/agujero supraorbitario (marcas de superficie)
  P('surco_supraorbitario', pathLine(SKULL.supraorbitalGroove, 'projection2', 0.0035, { radial: 8 }), 'proyeccion');
  P('surco_supraorbitario', pathLine(SKULL.supraorbitalGroove.map((p) => V(p.x, p.y, -p.z)), 'projection2', 0.0035, { radial: 8 }), 'proyeccion');
  B('canal_supraorbitario', ring(SKULL.supraorbitalForamen, V(0, 1, 0.2), 0.005, 0.0016, 'marker', '#caa24a'), 'proyeccion');

  // Agujero infraorbitario (salida del n. infraorbitario)
  B('ag_infraorbitario', ring(SKULL.infraorbitalForamen, V(0.3, 0, 1), 0.006, 0.0018, 'marker', '#caa24a'), 'proyeccion');
}

function frontalBoneMat() {
  return blobMat('bone');
}
// Material por preset (cacheado y clonado para no compartir estado entre mallas).
function blobMat(kind) {
  return makeMaterial(kind);
}

// Hueso elongado tipo cápsula entre dos puntos.
function elong(a, b, r, kind) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), blobMat(kind));
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}

// Reborde orbitario (anillo óseo completo, resaltado en vacuno).
function orbitRim(center, r) {
  const g = new THREE.TorusGeometry(r, 0.0075, 14, 40);
  const m = new THREE.Mesh(g, blobMat('bone'));
  m.position.copy(center);
  m.quaternion.setFromUnitVectors(V(0, 0, 1), V(0.3, 0.0, 1).normalize());
  return m;
}

// Globo ocular del vacuno (~3.5 cm): esclerótica, iris oscuro con pupila
// horizontal, córnea brillante translúcida y párpados sugeridos.
const EYE_AXIS = V(0.3, 0.0, 1).normalize();   // eje óptico, lateral y algo rostral
function eyeball(center) {
  const g = new THREE.Group();
  const R = 0.0175;                       // radio del globo (diámetro ~3.5 cm)
  // Esclerótica (globo)
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), makeMaterial('eye',
    { color: '#e9e4db', roughness: 0.35, clearcoat: 0.5 }));
  g.add(sclera);
  // Iris oscuro: casquete ligeramente abombado en el polo del eje óptico
  const iris = new THREE.Mesh(new THREE.SphereGeometry(R * 0.62, 24, 16, 0, Math.PI * 2, 0, 0.62), makeMaterial('eye',
    { color: '#2a1d12', roughness: 0.3, clearcoat: 0.7 }));
  iris.position.copy(EYE_AXIS.clone().multiplyScalar(R * 0.78));
  iris.quaternion.setFromUnitVectors(V(0, 1, 0), EYE_AXIS);
  g.add(iris);
  // Pupila horizontal (banda oscura alargada)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.26, 18, 12), makeMaterial('eye',
    { color: '#07050a', roughness: 0.15, clearcoat: 0.9 }));
  pupil.scale.set(0.45, 0.42, 1.0);
  pupil.position.copy(EYE_AXIS.clone().multiplyScalar(R * 0.9));
  g.add(pupil);
  // Córnea: casquete transparente y muy brillante sobre el iris
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 24, 16, 0, Math.PI * 2, 0, 0.72),
    makeMaterial('eye', { color: '#cfe6ef', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.3, depthWrite: false }));
  cornea.position.copy(EYE_AXIS.clone().multiplyScalar(R * 0.12));
  cornea.quaternion.setFromUnitVectors(V(0, 1, 0), EYE_AXIS);
  g.add(cornea);
  // Párpados sugeridos: arcos superior e inferior
  for (const sign of [1, -1]) {
    const lid = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, 0.0022, 8, 24, Math.PI * 0.9),
      makeMaterial('skin', { color: '#caa892', opacity: 0.85, transparent: true }));
    lid.quaternion.setFromUnitVectors(V(0, 0, 1), EYE_AXIS);
    lid.rotateZ(sign > 0 ? 0.15 : Math.PI - 0.15);
    g.add(lid);
  }
  g.position.copy(center);
  return g;
}

// ─────────────────────────────────────────────────────────────
// 2 · MANDÍBULA, DIENTES
// ─────────────────────────────────────────────────────────────
function buildMandibleAndTeeth(P, B) {
  const alv = MANDIBLE.alveolarTop;
  // Semieje lateral (grosor hacia +z) de la hemimandíbula por x local.
  const halfZ = (x) => lerp(0.013, 0.007, Math.max(0, (x - 0.06) / 0.44));

  // ── CUERPO de la mandíbula ──────────────────────────────────
  // Hemimandíbula izquierda construida como barra ósea curva que recorre
  // el BORDE VENTRAL desde el ángulo (caudal) hasta los incisivos (rostral).
  // La sección es una superelipse en el plano x-y (alto dorsoventral,
  // grosor lateral pequeño) con up=+z, de modo que NO se despliega hacia fuera.
  // Borde ventral (y) por x local: hondo caudal, sube hacia el mentón.
  const ventral = (x) => lerp(-0.205, -0.125, Math.min(1, Math.max(0, (x - 0.05) / 0.44)));
  const zc = 0.052;                       // plano parasagital de la hemimandíbula
  const bodyPath = [];
  for (let i = 0; i <= 6; i++) {
    const x = lerp(0.045, 0.49, i / 6);
    const yv = ventral(x), yt = alv(x);
    bodyPath.push(V(x, (yv + yt) / 2, zc));   // eje por el centro del hueso
  }
  const cuerpo = loft(
    bodyPath,
    (t) => {
      const x = lerp(0.045, 0.49, t);
      const yv = ventral(x), yt = alv(x);
      const h = Math.max(0.012, (yt - yv) / 2);   // alto dorsoventral
      return { w: halfZ(x), h, p: 2.6, wTop: halfZ(x) * 0.78, wBot: halfZ(x) * 0.9 };
    },
    'bone', { segs: 34, radial: 20, up: [0, 0, 1] },
  );
  B('cuerpo_mandibula', cuerpo, 'hueso');

  // ── RAMA de la mandíbula ────────────────────────────────────
  // Lámina vertical caudal: del ángulo (abajo) al cóndilo/ATM y coronoides
  // (arriba), en el mismo plano parasagital. up=+z para que quede en el plano x-y.
  const ramaPath = [
    V(MANDIBLE.angle.x + 0.01, MANDIBLE.angle.y, zc),      // ángulo
    V(0.06, -0.12, zc),
    V(0.075, -0.06, zc),
    V(MANDIBLE.tmj.x, MANDIBLE.tmj.y, zc),                  // cóndilo (ATM)
  ];
  const rama = loft(
    ramaPath,
    (t) => ({ w: lerp(0.012, 0.007, t), h: lerp(0.052, 0.02, t), p: 2.8, dz: 0 }),
    'bone', { segs: 22, radial: 18, up: [0, 0, 1] },
  );
  B('rama_mandibula', rama, 'hueso');
  // Cóndilo articular (ATM)
  B('rama_mandibula', blob(V(MANDIBLE.tmj.x, MANDIBLE.tmj.y, zc), [0.012, 0.008, 0.012], 'bone2', { noise: 0.02, detail: 3 }), 'hueso');
  // Apófisis coronoides (punta dorsal rostral de la rama)
  B('rama_mandibula', blob(V(MANDIBLE.coronoid.x, MANDIBLE.coronoid.y, zc), [0.012, 0.022, 0.008], 'bone2',
    { noise: 0.03, detail: 3, deform: (v) => { v.y *= 1.0; } }), 'hueso');

  // Ángulo de la mandíbula
  B('ang_mandibula', blob(V(MANDIBLE.angle.x, MANDIBLE.angle.y, zc), [0.016, 0.018, 0.011], 'bone2', { noise: 0.04, detail: 3 }), 'hueso');

  // Escotadura de los vasos faciales (muesca en borde ventral) — marca de superficie
  B('escotadura_vasos', ring(MANDIBLE.facialNotch, V(0, 0, 1), 0.007, 0.0022, 'marker', '#caa24a'), 'proyeccion');

  // Borde interalveolar (diastema, línea) — proyección sobre la cara lateral
  P('borde_interalveolar', pathLine([MANDIBLE.interalveolar[0], MANDIBLE.interalveolar[1]], 'projection2', 0.0035, { radial: 8 }), 'proyeccion');
  P('borde_interalveolar', pathLine([V(MANDIBLE.interalveolar[0].x, MANDIBLE.interalveolar[0].y, -MANDIBLE.interalveolar[0].z), V(MANDIBLE.interalveolar[1].x, MANDIBLE.interalveolar[1].y, -MANDIBLE.interalveolar[1].z)], 'projection2', 0.0035, { radial: 8 }), 'proyeccion');

  // Borde ventral de la mandíbula (línea palpable, sigue el canto inferior del hueso)
  {
    const ventral = (x) => lerp(-0.205, -0.125, Math.min(1, Math.max(0, (x - 0.05) / 0.44)));
    const bvPts = [];
    for (let i = 0; i <= 6; i++) {
      const x = lerp(0.05, 0.49, i / 6);
      bvPts.push(V(x, ventral(x) - 0.004, 0.052));
    }
    B('borde_ventral_mandibula', pathLine(bvPts, 'projection2', 0.0028, { radial: 8 }), 'proyeccion');
  }

  // Agujero mentoniano (marca de superficie)
  B('ag_mentoniano', ring(MANDIBLE.mentalForamen, V(0.2, -0.3, 1), 0.005, 0.0016, 'marker', '#caa24a'), 'proyeccion');

  // ── DIENTES ──
  // Incisivos inferiores I1-I3 + canino incisiviforme (por hemiarcada, espejados)
  const incGroup = group();
  const canGroup = group();
  const incX = 0.5, incZbase = 0.006;
  for (let i = 0; i < 4; i++) {
    const z = incZbase + i * 0.009;
    const x = incX - i * 0.004;
    const y = MANDIBLE.incisors.y + 0.012;
    const tooth = incisor(V(x, y, z), i === 3);
    (i === 3 ? canGroup : incGroup).add(tooth);
  }
  B('incisivos', incGroup, 'hueso');
  B('caninos', canGroup, 'hueso');

  // Premolares y molares (superiores e inferiores), selenodontos
  const upRow = SKULL.upperCheekTeeth;   // [0.17 (M3) .. 0.335 (P2)]
  const loToothZ = 0.03;
  const premU = group(), molU = group(), premL = group(), molL = group();
  // 6 dientes de mejilla por fila: P2,P3,P4,M1,M2,M3 (rostral->caudal)
  for (let k = 0; k < 6; k++) {
    const t = k / 5;                       // 0 = P2 (rostral), 1 = M3 (caudal)
    const x = lerp(upRow[1], upRow[0], t); // 0.335 -> 0.17
    const isMolar = k >= 3;
    const zU = SKULL.toothRowZ;
    const yU = SKULL.palate(x) + 0.012;
    const yL = MANDIBLE.alveolarTop(x) - 0.012;
    const w = isMolar ? 0.016 : 0.012;
    (isMolar ? molU : premU).add(cheekTooth(V(x, yU, zU), w, -1));
    (isMolar ? molL : premL).add(cheekTooth(V(x + 0.004, yL, loToothZ), w, 1));
  }
  B('premolares', group(premU, premL), 'hueso');
  B('molares', group(molU, molL), 'hueso');
}

function incisor(p, canine) {
  const g = new THREE.Group();
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(canine ? 0.0075 : 0.009, 14, 10),
    blobMat('tooth'),
  );
  crown.scale.set(1.0, 1.4, canine ? 0.7 : 0.9);
  const rootm = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.02, 10), blobMat('tooth'));
  rootm.position.y = -0.015;
  g.add(crown, rootm);
  g.position.copy(p);
  g.rotation.z = 0.35;      // inclinados rostralmente
  return g;
}

function cheekTooth(p, w, dir) {
  // corona selenodonta: bloque con dos crestas en media luna
  const g = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.016), blobMat('tooth'));
  crown.geometry.translate(0, 0, 0);
  g.add(crown);
  for (const sx of [-0.25, 0.25]) {
    const cusp = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0016, 8, 14, Math.PI), blobMat('tooth'));
    cusp.position.set(sx * w, 0.011, 0);
    cusp.rotation.x = Math.PI / 2;
    g.add(cusp);
  }
  const rootm = new THREE.Mesh(new THREE.ConeGeometry(w * 0.4, 0.026, 8), blobMat('tooth'));
  rootm.position.y = dir > 0 ? 0.018 : -0.018;
  rootm.rotation.z = dir > 0 ? Math.PI : 0;
  g.add(rootm);
  g.position.copy(p);
  return g;
}

// ─────────────────────────────────────────────────────────────
// 3 · APARATO HIOIDES
// ─────────────────────────────────────────────────────────────
function buildHyoid(P, B) {
  // Basihioides: barra transversa ventral con apófisis lingual rostral
  const basi = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.05, 6, 12), blobMat('bone'));
  basi.rotation.x = Math.PI / 2;
  basi.position.set(PHARYNX.larynx.x + 0.02, PHARYNX.larynx.y + 0.02, 0);
  const lingual = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.03, 10), blobMat('bone'));
  lingual.rotation.z = -Math.PI / 2;
  lingual.position.set(PHARYNX.larynx.x + 0.05, PHARYNX.larynx.y + 0.025, 0);
  P('basihioides', group(basi, lingual), 'hueso');

  // Estilohioides hacia la apófisis estiloidea + ángulo estilohioideo
  B('basihioides', tube([V(0.02, PHARYNX.larynx.y + 0.02, 0.03), V(0.0, -0.08, 0.05), V(0.01, -0.03, 0.062)], 0.004, 'bone', { radial: 8 }), 'hueso');
  B('ang_estilohioideo', marker(V(0.012, -0.028, 0.063), '#d8caa8', 0.007, 'bone2'), 'hueso');
}

// ─────────────────────────────────────────────────────────────
// 4 · CUERNOS (estuche córneo, epiceras, dermis, núcleo óseo)
// ─────────────────────────────────────────────────────────────
function buildHorns(P, B) {
  // Trayecto del cuerno: lateral desde la base, luego rostrodorsal.
  const base = SKULL.cornualBase.clone();
  const path = [
    base,
    base.clone().add(V(0.0, 0.03, 0.055)),
    base.clone().add(V(0.02, 0.07, 0.11)),
    base.clone().add(V(0.06, 0.12, 0.14)),
    base.clone().add(V(0.12, 0.16, 0.15)),
  ];
  // Núcleo óseo (apófisis cornual, neumatizado) — algo más corto y fino
  const corePath = path.slice(0, 4).map((p, i) => p.clone().sub(V(0, 0, 0).addScaledVector(V(0.01, 0.01, 0.01), i * 0)));
  B('ap_cornual', tube(corePath, (t) => lerp(0.018, 0.008, t), 'bone2', { radial: 14 }), 'hueso');

  // Dermis del cuerno (capa fina entre estuche y núcleo)
  B('dermis_cuerno', tube(path.slice(0, 4), (t) => lerp(0.022, 0.009, t), 'horn2', { radial: 14, mat: { transparent: true, opacity: 0.6 } }), 'piel');

  // Estuche córneo: base, cuerpo, vértice
  B('cuerno_base', tube([path[0], path[1]], (t) => lerp(0.026, 0.021, t), 'horn2', { radial: 16 }), 'piel');
  B('cuerno_cuerpo', tube([path[1], path[2], path[3]], (t) => lerp(0.021, 0.013, t), 'horn', { radial: 16 }), 'piel');
  B('cuerno_vertice', tube([path[3], path[4]], (t) => lerp(0.013, 0.002, t), 'horn', { radial: 14, cap: true }), 'piel');

  // Epiceras: anillo blando en la base
  B('epiceras', ring(path[0].clone().add(V(0, 0, 0)), path[1].clone().sub(path[0]).normalize(), 0.027, 0.004, 'horn2'), 'piel');
}

// ─────────────────────────────────────────────────────────────
// 5 · SENOS PARANASALES (volúmenes translúcidos 'sinus')
// ─────────────────────────────────────────────────────────────
function buildSinuses(P, B) {
  // Opacidad baja: en el corte sagital los senos se superponen (frontal,
  // maxilar, palatino, conchales…). Con 0.22 leen como UNA sola capa
  // translúcida suave en lugar de un amontonamiento de burbujas azules.
  const sm = { transparent: true, opacity: 0.22, depthWrite: false };
  // Volumen de seno orgánico (abombado, nunca aplastado).
  const sinusVol = (c, r, seed, extra = {}) => blob(c, r, 'sinus',
    { noise: 0.09, freq: 3.2, detail: 3, seed, mat: sm, ...extra });

  // Seno frontal caudal: enorme, ocupa todo el frontal caudal, confluente,
  // con divertículo cornual (hacia el núcleo del cuerno) y parte nucal.
  const sfc = group(
    sinusVol(V(0.06, 0.05, 0.042), [0.085, 0.04, 0.05], 11),
    // divertículo cornual: se prolonga hacia la base de la apófisis cornual
    blob(V(0.02, 0.088, 0.068), [0.028, 0.03, 0.03], 'sinus',
      { noise: 0.06, freq: 4, detail: 3, seed: 12, mat: sm,
        deform: (v) => { v.y += Math.max(0, v.z) * 0.4; } }),
    // divertículo nucal (hacia la línea de la nuca)
    sinusVol(V(-0.012, 0.062, 0.022), [0.032, 0.034, 0.036], 13),
  );
  B('seno_frontal_caudal', sfc, 'seno');

  // Senos frontales rostrales (pequeños, entre las órbitas)
  B('senos_frontales_rostrales', sinusVol(V(0.155, 0.045, 0.03), [0.028, 0.024, 0.026], 14), 'seno');

  // Seno maxilar (sobre los molares superiores, volumen amplio)
  B('seno_maxilar', sinusVol(V(0.23, -0.015, 0.052), [0.052, 0.036, 0.03], 15), 'seno');

  // Seno palatino (en el paladar duro, ventral a la cavidad nasal) — con volumen
  B('seno_palatino', sinusVol(V(0.3, -0.058, 0.03), [0.05, 0.024, 0.026], 16), 'seno');

  // Seno lagrimal (rostromedial a la órbita)
  B('seno_lagrimal', sinusVol(V(0.185, -0.012, 0.056), [0.022, 0.022, 0.02], 17), 'seno');

  // Senos conchales (dentro de las conchas, rostrales)
  B('senos_conchales', sinusVol(V(0.33, 0.0, 0.022), [0.036, 0.024, 0.02], 18), 'seno');

  // Seno esfenoidal (pequeño, base del cráneo)
  B('seno_esfenoidal', sinusVol(V(0.05, -0.028, 0.016), [0.02, 0.016, 0.015], 19), 'seno');

  // Aberturas/comunicaciones como anillos pequeños. Capa 'proyeccion': son
  // marcas puntuales en paredes laterales que, en el corte sagital, leen como
  // aros azules sueltos superpuestos a los senos; fuera de la lámina.
  B('ab_nasomaxilar', ring(V(0.23, 0.0, 0.028), V(0, 0, 1), 0.006, 0.0018, 'marker', '#5ab4e6'), 'proyeccion');
  B('ab_maxilopalatina', ring(V(0.25, -0.04, 0.02), V(0, -0.3, 1), 0.007, 0.002, 'marker', '#5ab4e6'), 'proyeccion');
  B('com_seno_lagrimal', ring(V(0.2, -0.005, 0.05), V(0.3, 0.2, 1), 0.005, 0.0016, 'marker', '#5ab4e6'), 'proyeccion');
}

// ─────────────────────────────────────────────────────────────
// 6 · CAVIDAD NASAL (visible con clip=sag:0)
// ─────────────────────────────────────────────────────────────
function buildNasalCavity(P, B) {
  const airM = { transparent: true, opacity: 0.2, depthWrite: false };

  // Septo nasal: lámina media CARTILAGINOSA en el plano medio (z=0). En el
  // corte sagital se ve de canto como el borde del tabique: una lámina baja
  // que sigue el dorso nasal y NO llega al suelo por caudal. Antes era un
  // sheet extruido grande que leía como un panel cian plano; ahora es una
  // superficie fina perfilada (loft estrecho) que da un borde limpio al cortar.
  // El tabique ocupa sólo la parte DORSAL de la cavidad (entre las conchas y
  // el dorso nasal) y se afina en sus extremos, de modo que en el corte lee
  // como el BORDE del tabique, no como un gran panel cian. Perfil fusiforme:
  // bajo en los extremos, algo más alto en el centro, siempre delgado.
  P('septo_nasal', loft(
    [V(0.21, 0.012, 0), V(0.28, 0.016, 0), V(0.35, 0.016, 0), V(0.42, 0.014, 0), V(0.46, 0.014, 0)],
    (t) => {
      // altura modesta, máxima hacia el centro y mínima en los extremos
      const h = 0.006 + 0.016 * Math.sin(Math.min(1, t * 1.15) * Math.PI);
      return { w: 0.002, h, p: 2.0, dy: 0 };
    },
    'cartilage', { segs: 30, radial: 10, caps: false }), 'hueso');

  // Conchas (escrolls enrollados): dorsal (larga fina), ventral (gruesa),
  // media (pequeña caudal). Sección enrollada que al cortarse da espiras.
  B('concha_dorsal', scroll(V(0.26, 0.03, 0.022), 0.2, 0.013, 0.016, 2.4), 'hueso');
  B('concha_ventral', scroll(V(0.28, -0.018, 0.028), 0.19, 0.024, 0.03, 3.0), 'hueso');
  B('concha_media', scroll(V(0.2, 0.012, 0.024), 0.055, 0.012, 0.015, 1.6), 'hueso');

  // Conchas etmoidales (cluster de pequeñas espiras en el fundus caudal)
  const etm = group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    etm.add(blob(V(0.18 + Math.cos(a) * 0.012, 0.02 + Math.sin(a) * 0.016, 0.028 + (i % 2) * 0.008),
      [0.009, 0.011, 0.009], 'bone2', { noise: 0.18, freq: 7, detail: 3, seed: 40 + i }));
  }
  B('conchas_etmoidales', etm, 'hueso');

  // Meatos: NO son placas planas sino canales de aire estrechos y curvos entre
  // las conchas. Cada uno es un tubo de sección pequeña y algo aplanada que
  // recorre la cavidad; al cortarlo en sagital da una hendidura limpia.
  // Cada meato es un CANAL de aire estrecho y curvo (sección pequeña y casi
  // circular, no una lámina). Antes se aplanaban con flat>1 y leían como
  // paneles cian; ahora son tubos finos que dan una hendidura limpia al cortar.
  const meatus = (y, z, r, seed) => {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, x = lerp(0.22, 0.42, t);
      pts.push(V(x, y + Math.sin(t * Math.PI) * 0.005, z + 0.004 * noiseish(seed, i)));
    }
    return tube(pts, (t) => r * (0.5 + 0.6 * Math.sin(t * Math.PI)), 'airspace',
      { radial: 12, mat: airM });
  };
  B('meato_dorsal', meatus(0.05, 0.03, 0.004, 1), 'cavidad');
  B('meato_medio', meatus(0.016, 0.032, 0.0045, 2), 'cavidad');
  B('meato_ventral', meatus(-0.03, 0.034, 0.005, 3), 'cavidad');
  // Meato común: espacio aéreo MEDIO y estrecho que corre junto al tabique
  // comunicando los demás meatos. Antes era un panel alto que leía como una
  // lámina cian plana; ahora es un canal fino (tubo de sección pequeña y algo
  // alargada en vertical) pegado al septo, que en el corte da una hendidura.
  P('meato_comun', tube(
    [V(0.22, 0.004, 0), V(0.3, 0.004, 0), V(0.4, -0.004, 0), V(0.45, -0.008, 0)],
    (t) => 0.007 * (0.6 + 0.5 * Math.sin(t * Math.PI)), 'airspace',
    { radial: 12, mat: airM }), 'cavidad');

  // Órgano vomeronasal (par de tubos en el suelo, junto al septo)
  B('organo_vomeronasal', tube([V(0.36, -0.05, 0.008), V(0.44, -0.055, 0.008)], 0.004, 'mucosa', { radial: 8 }), 'cavidad');
}

// Pseudo-ruido determinista pequeño para desplazar puntos (sin dependencias).
function noiseish(seed, i) {
  const h = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1;
}

// Concha nasal: escroll (tubo aplanado enrollado en espira). `turns` controla
// cuántas vueltas da la espira, para que al cortarse se vea enrollada.
function scroll(center, len, h, w, turns = 2.4) {
  const pts = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // la espira se enrolla en el plano x-y mientras avanza en x
    const ang = t * Math.PI * turns;
    const rad = h * (0.4 + 0.5 * t);
    pts.push(V(
      center.x + lerp(len / 2, -len / 2, t) + Math.cos(ang) * rad * 0.3,
      center.y + Math.sin(ang) * rad,
      center.z,
    ));
  }
  return tube(pts, (t) => lerp(w, w * 0.5, t) * (0.7 + 0.3 * Math.sin(t * Math.PI)), 'bone2', { radial: 12, flat: 0.55 });
}

// Volumen de aire orgánico (antes caja): elipsoide suave con ligero ruido.
// Se mantiene la firma (center, half=[hx,hy,hz], mat) para no tocar las llamadas.
let _slabSeed = 100;
function slab(center, half, mat) {
  const m = blob(center, half, 'airspace', { noise: 0.05, freq: 3, detail: 3, seed: _slabSeed++ });
  m.material.transparent = true;
  m.material.opacity = (mat && mat.opacity != null) ? mat.opacity : 0.32;
  m.material.depthWrite = false;
  return m;
}

// ─────────────────────────────────────────────────────────────
// 7 · BOCA Y LENGUA
// ─────────────────────────────────────────────────────────────
function buildMouth(P, B) {
  const air = { transparent: true, opacity: 0.2, depthWrite: false };

  // Paladar duro (techo de la boca): lámina curva fina que sigue el paladar
  // óseo, no un bloque. Se abomba ligeramente hacia la cavidad bucal.
  P('paladar_duro', loft(
    [V(0.19, -0.072, 0), V(0.28, -0.074, 0), V(0.37, -0.075, 0), V(0.45, -0.078, 0), V(0.49, -0.082, 0)],
    (t) => { const w = lerp(0.05, 0.028, t); return { w, h: 0.006, p: 2.4, wTop: w, wBot: w * 0.9 }; },
    'mucosa', { segs: 26, radial: 20, up: [0, 1, 0] }), 'cavidad');
  P('rafe_palatino', pathLine([V(0.21, -0.078, 0), V(0.47, -0.073, 0)], 'projection2', 0.0025, { radial: 8 }), 'proyeccion');
  // Almohadilla dentaria (reemplaza incisivos superiores)
  P('almohadilla_dentaria', blob(V(0.49, -0.085, 0), [0.016, 0.01, 0.03], 'mucosa', { noise: 0.03, detail: 3 }), 'cavidad');
  // Papila incisiva
  P('papila_incisiva', marker(V(0.46, -0.078, 0), '#f0a0a0', 0.006, 'mucosa'), 'cavidad');

  // Rugosidades palatinas: crestas transversales
  const rug = group();
  for (let i = 0; i < 10; i++) {
    const x = lerp(0.46, 0.3, i / 9);
    const w = lerp(0.03, 0.05, i / 9);
    rug.add(ridge(V(x, -0.072, 0), w));
  }
  P('rugosidades_palatinas', rug, 'cavidad');

  // Labios
  P('labios', loft(
    [V(0.46, -0.03, 0.03), V(0.5, -0.05, 0), V(0.46, -0.03, -0.03)],
    () => ({ w: 0.02, h: 0.018, p: 2.0 }),
    'mucosa', { segs: 14, radial: 16, caps: false }), 'cavidad');

  // Vestíbulo (espacio mejilla-dientes): canal de aire estrecho y curvo entre
  // la mejilla y la arcada, no una placa. Tubo de sección aplanada.
  B('vestibulo_boca', tube(
    [V(0.24, -0.055, 0.052), V(0.33, -0.05, 0.055), V(0.42, -0.045, 0.05)],
    (t) => 0.01 * (0.7 + 0.4 * Math.sin(t * Math.PI)), 'airspace',
    { radial: 10, flat: 0.5, mat: air }), 'cavidad');
  // Cavidad propia de la boca (aire entre lengua y paladar): lente media
  // alargada, abombada dorsoventralmente (no un bloque plano).
  P('cavidad_propia_boca', blob(V(0.33, -0.052, 0), [0.11, 0.016, 0.03], 'airspace',
    { noise: 0.05, freq: 3, detail: 3, seed: 61, mat: air,
      deform: (v) => { v.y -= 0.004 * (1 - Math.min(1, (v.x * v.x) / 0.004)); } }), 'cavidad');

  // Mucosa de la boca (lámina lateral interior, perfilada, no plana rígida)
  B('mucosa_boca', loft(
    [V(0.22, -0.055, 0.046), V(0.3, -0.05, 0.05), V(0.4, -0.045, 0.048), V(0.45, -0.04, 0.042)],
    () => ({ w: 0.003, h: 0.03, p: 2.2 }),
    'mucosa', { segs: 22, radial: 10, up: [0, 1, 0], caps: false }), 'cavidad');

  // Carúncula sublingual
  P('caruncula_sublingual', marker(V(0.47, -0.095, 0.008), '#f0a0a0', 0.005, 'mucosa'), 'cavidad');

  // Papilas bucales (cónicas en la mejilla, dirigidas caudalmente)
  const buc = group();
  for (let i = 0; i < 7; i++) {
    const x = lerp(0.4, 0.28, i / 6);
    buc.add(conePapilla(V(x, -0.058, 0.055), 0.004, 0.012, V(-1, 0, 0)));
  }
  B('papilas_bucales', buc, 'cavidad');

  // ── LENGUA ──
  const lengua = loft(
    [V(0.14, -0.07, 0), V(0.24, -0.07, 0), V(0.34, -0.065, 0), V(0.44, -0.06, 0), V(0.5, -0.055, 0)],
    (t) => {
      const base = { w: lerp(0.03, 0.016, t), h: lerp(0.028, 0.016, t), p: 2.4 };
      return base;
    },
    'tongue', { segs: 30, radial: 24 },
  );
  P('lengua', lengua, 'cavidad');

  // Torus lingual (elevación dorsal caudal)
  P('torus_lingual', blob(V(0.2, -0.045, 0), [0.045, 0.022, 0.028], 'tongue', { noise: 0.04, detail: 3 }), 'cavidad');
  // Fosa lingual (depresión transversal rostral al torus)
  P('fosa_lingual', slab(V(0.26, -0.048, 0), [0.012, 0.004, 0.022], { opacity: 0.5 }), 'cavidad');
  // Tonsila lingual (raíz), par. Antes se registraba con P (una pieza en +z,
  // que el corte elimina) y además con B (que ya crea el par izq/dcho): el P
  // dejaba una tercera copia superpuesta. Solo B, para el par limpio.
  B('tonsila_lingual', blob(V(0.15, -0.06, 0.012), [0.012, 0.008, 0.01], 'lymph', { noise: 0.05, detail: 2 }), 'cavidad');
  // Frenillo
  P('frenillo', sheet([[0.4, -0.075], [0.47, -0.07], [0.47, -0.09], [0.4, -0.092]], 0.002, 'mucosa'), 'cavidad');

  // Papilas mecánicas (conos sobre el torus) y gustativas (valladas + fungiformes)
  const mec = group();
  for (let i = 0; i < 14; i++) {
    const x = lerp(0.22, 0.18, (i % 7) / 6);
    const z = (i < 7 ? 1 : -1) * (0.004 + (i % 7) * 0.003);
    mec.add(conePapilla(V(x, -0.028, z), 0.0025, 0.007, V(-0.6, 0.6, 0)));
  }
  P('papilas_mecanicas', mec, 'cavidad');

  const gus = group();
  // valladas: fila a cada lado caudal al torus
  for (let i = 0; i < 4; i++) {
    const x = lerp(0.17, 0.13, i / 3);
    gus.add(ring(V(x, -0.04, 0.012), V(0, 1, 0), 0.004, 0.0012, 'marker', '#d9797a'));
    gus.add(ring(V(x, -0.04, -0.012), V(0, 1, 0), 0.004, 0.0012, 'marker', '#d9797a'));
  }
  // fungiformes: puntos dispersos rostrales
  for (let i = 0; i < 10; i++) {
    const x = lerp(0.42, 0.3, i / 9);
    gus.add(marker(V(x, -0.052, (i % 2 ? 1 : -1) * 0.013), '#e07a7a', 0.0022, 'marker'));
  }
  P('papilas_gustativas', gus, 'cavidad');
}

function ridge(center, w) {
  const g = new THREE.Mesh(new THREE.TorusGeometry(w, 0.0025, 6, 16, Math.PI), blobMat('mucosa'));
  g.position.copy(center);
  g.rotation.set(Math.PI / 2, 0, 0);
  return g;
}

function conePapilla(p, r, h, dir) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), blobMat('mucosa'));
  m.position.copy(p);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  return m;
}

// ─────────────────────────────────────────────────────────────
// 8 · FARINGE Y LARINGE
// ─────────────────────────────────────────────────────────────
function buildPharynxLarynx(P, B) {
  const air = { transparent: true, opacity: 0.2, depthWrite: false };

  // Nasofaringe (aire dorsal al paladar blando): bolsa de aire redondeada
  P('nasofaringe', blob(V(0.06, -0.05, 0), [0.04, 0.022, 0.022], 'airspace',
    { noise: 0.06, freq: 3, detail: 3, seed: 71, mat: air }), 'cavidad');
  // Septo faríngeo (lámina media fina, perfilada)
  P('septo_faringeo', loft(
    [V(0.02, -0.045, 0), V(0.06, -0.045, 0), V(0.09, -0.045, 0)],
    () => ({ w: 0.0022, h: 0.016, p: 2.0 }),
    'mucosa', { segs: 14, radial: 10, caps: false }), 'cavidad');
  // Tonsila faríngea (techo de la nasofaringe)
  P('tonsila_faringea', blob(V(0.05, -0.03, 0), [0.012, 0.008, 0.012], 'lymph', { noise: 0.05, detail: 2 }), 'cavidad');
  // Orofaringe (bolsa de aire redondeada, confluencia boca/faringe)
  P('orofaringe', blob(V(0.07, -0.11, 0), [0.035, 0.024, 0.022], 'airspace',
    { noise: 0.06, freq: 3, detail: 3, seed: 72, mat: air }), 'cavidad');
  // Tonsila palatina + seno tonsilar (pared lateral de la orofaringe)
  B('tonsila_palatina', blob(V(0.08, -0.1, 0.03), [0.01, 0.009, 0.007], 'lymph', { noise: 0.05, detail: 2 }), 'cavidad');
  B('seno_tonsilar', ring(V(0.08, -0.1, 0.034), V(0, 0, 1), 0.008, 0.002, 'marker', '#6cc08a'), 'proyeccion');
  // Laringofaringe (bolsa de aire caudal, se continúa con el esófago)
  P('laringofaringe', blob(V(0.0, -0.14, 0), [0.03, 0.022, 0.02], 'airspace',
    { noise: 0.06, freq: 3, detail: 3, seed: 73, mat: air }), 'cavidad');
  // Nnll retrofaríngeos mediales (dorsales a faringe)
  P('nnll_retrofaringeos_med', blob(V(0.04, -0.03, 0.0), [0.012, 0.009, 0.012], 'lymph', { noise: 0.06, detail: 2 }), 'linfa');

  // Laringe: cartílago tiroides + cricoides/epiglotis (contexto) + cavidad + ligamentos
  const thyroid = blob(PHARYNX.larynx, [0.022, 0.02, 0.018], 'cartilage', { noise: 0.03, detail: 3 });
  P('cartilago_tiroides', thyroid, 'hueso');
  // cricoides y epiglotis de contexto
  P(null, blob(V(PHARYNX.larynx.x - 0.025, PHARYNX.larynx.y, 0), [0.014, 0.016, 0.014], 'cartilage', { noise: 0.02, detail: 3 }), 'hueso');
  P(null, new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 10), blobMat('cartilage'))
    .translateX(PHARYNX.larynx.x + 0.02).translateY(PHARYNX.larynx.y + 0.01), 'hueso');

  // Cavidad de la laringe (luz, airspace)
  P('cavidad_laringe', slab(PHARYNX.larynx.clone().add(V(0, 0.002, 0)), [0.012, 0.014, 0.01], air), 'cavidad');
  // Ligamentos vocal y vestibular (par)
  B('lig_vocal', pathLine([V(PHARYNX.larynx.x - 0.008, PHARYNX.larynx.y - 0.008, 0.002), V(PHARYNX.larynx.x - 0.008, PHARYNX.larynx.y + 0.006, 0.008)], 'projection2', 0.0025, { radial: 8 }), 'proyeccion');
  B('lig_vestibular', pathLine([V(PHARYNX.larynx.x + 0.004, PHARYNX.larynx.y - 0.006, 0.002), V(PHARYNX.larynx.x + 0.004, PHARYNX.larynx.y + 0.006, 0.008)], 'projection2', 0.0025, { radial: 8 }), 'proyeccion');
}

// ─────────────────────────────────────────────────────────────
// 9 · DISECCIÓN SUPERFICIAL (músculos, nervios, vasos, linfa, glándulas)
// ─────────────────────────────────────────────────────────────
function buildSuperficial(P, B) {
  // ── MÚSCULOS ──
  // Masetero (gran músculo plano sobre la rama mandibular, desde el arco
  // cigomático y la tuberosidad facial hasta el ángulo). Lámina lateral,
  // ventral a la órbita y caudal; centrada sobre la rama vertical.
  B('m_masetero', blob(V(0.1, -0.1, 0.088), [0.06, 0.07, 0.016], 'muscle',
    { noise: 0.07, freq: 3, detail: 3, seed: 31,
      // abombado por fuera, se adelgaza hacia los bordes y no cruza al medio
      deform: (v) => { v.z = Math.max(v.z, 0.0); v.z += 0.004 * (1 - Math.min(1, (v.x * v.x + v.y * v.y) / 0.004)); } }), 'musculo');
  // Buccinador (mejilla)
  B('m_buccinador', blob(V(0.27, -0.07, 0.07), [0.06, 0.03, 0.012], 'muscle2', { noise: 0.04, detail: 3 }), 'musculo');
  // Cigomático (banda arco cigomático -> comisura)
  B('m_cigomatico', tube([V(0.13, -0.03, 0.11), V(0.3, -0.05, 0.08), V(0.44, -0.05, 0.03)], 0.006, 'muscle3', { radial: 8 }), 'musculo');
  // Elevador nasolabial (dorso de la nariz)
  B('m_elevador_nasolabial', tube([V(0.2, 0.03, 0.06), V(0.35, 0.02, 0.05), V(0.46, 0.0, 0.02)], 0.008, 'muscle3', { radial: 8 }), 'musculo');
  // Elevador labio superior
  B('m_elevador_labio_sup', tube([V(0.28, -0.03, 0.07), V(0.4, -0.03, 0.045), V(0.47, -0.04, 0.02)], 0.006, 'muscle3', { radial: 8 }), 'musculo');
  // Depresor labio superior
  B('m_depresor_labio_sup', tube([V(0.26, -0.05, 0.08), V(0.4, -0.05, 0.05), V(0.47, -0.05, 0.02)], 0.005, 'muscle3', { radial: 8 }), 'musculo');
  // Depresor labio inferior (borde ventral del buccinador)
  B('m_depresor_labio_inf', tube([V(0.25, -0.08, 0.07), V(0.38, -0.09, 0.05), V(0.46, -0.1, 0.02)], 0.005, 'muscle3', { radial: 8 }), 'musculo');
  // Parotidoauricular (fascia parotídea -> base oreja)
  B('m_parotidoauricular', tube([V(0.02, -0.06, 0.08), V(0.0, 0.0, 0.1), V(0.0, 0.04, 0.09)], 0.006, 'muscle2', { radial: 8 }), 'musculo');

  // ── NERVIOS ──
  // Los nervios se dibujaban NEGROS en el corte: el preset 'nerve' trae
  // emissive oscuro y, como tubos finos lejos de la luz clave, el difuso
  // amarillo no llegaba a iluminarse. Se fuerza un material plano amarillo
  // (sin emissive y con emisión propia controlada) para que lean como nervio.
  const nerveMat = { emissive: '#000000', roughness: 0.5 };
  // N. facial: tronco caudal a la rama, bajo la parótida
  B('n_facial', tube([V(0.02, -0.04, 0.09), V(0.06, -0.06, 0.1), V(0.1, -0.07, 0.11)], 0.004, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Ramo bucal (horizontal sobre el masetero)
  B('n_facial_bucal', tube([V(0.1, -0.07, 0.11), V(0.2, -0.06, 0.09), V(0.32, -0.06, 0.07)], 0.003, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Ramo marginal (borde ventral)
  B('n_facial_marginal', tube([V(0.1, -0.08, 0.1), V(0.22, -0.11, 0.07), V(0.34, -0.12, 0.05)], 0.003, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Auriculopalpebral (rostral a la oreja hacia párpados)
  B('n_auriculopalpebral', tube([V(0.05, -0.02, 0.1), V(0.1, 0.03, 0.1), V(0.15, 0.04, 0.09)], 0.003, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Cornual (desde órbita por la línea temporal a la base del cuerno)
  B('n_cornual', tube([SKULL.orbit.clone().add(V(-0.01, 0.03, 0)), V(0.09, 0.06, 0.085), V(0.03, 0.09, 0.08), SKULL.cornualBase.clone()], 0.0035, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Infraorbitario (del agujero, abanico a nariz/labio)
  B('n_infraorbitario', tube([SKULL.infraorbitalForamen, V(0.38, -0.03, 0.045), V(0.45, -0.02, 0.02)], 0.003, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');
  // Mentoniano (del agujero mentoniano al labio inferior)
  B('n_mentoniano', tube([MANDIBLE.mentalForamen, V(0.44, -0.12, 0.02), V(0.48, -0.11, 0.008)], 0.003, 'nerve', { radial: 8, mat: nerveMat }), 'nervio');

  // ── VASOS ──
  // Convergencia en el origen de la yugular, local (0, -0.17, 0.085)
  const jug = V(0.0, -0.17, 0.085);
  // V. maxilar (a través de la parótida)
  B('v_maxilar', tube([V(0.05, -0.05, 0.1), V(0.02, -0.1, 0.095), jug], 0.005, 'vein', { radial: 8 }), 'vaso');
  // V. linguofacial (sobre la gl. mandibular)
  B('v_linguofacial', tube([V(0.18, -0.12, 0.07), V(0.08, -0.15, 0.08), jug], 0.005, 'vein', { radial: 8 }), 'vaso');
  // V. facial (cruza la escotadura y sube por la cara)
  B('v_facial', tube([MANDIBLE.facialNotch.clone().add(V(0, 0.005, 0)), V(0.2, -0.12, 0.075), V(0.18, -0.12, 0.07)], 0.004, 'vein', { radial: 8 }), 'vaso');
  B('v_facial', tube([MANDIBLE.facialNotch.clone().add(V(0, 0.005, 0)), V(0.22, -0.08, 0.075), V(0.28, -0.03, 0.065)], 0.004, 'vein', { radial: 8 }), 'vaso');
  // A. facial (acompaña a la v. facial)
  B('a_facial', tube([MANDIBLE.facialNotch.clone().add(V(0.004, 0.006, 0.002)), V(0.23, -0.07, 0.07), V(0.29, -0.03, 0.06)], 0.0035, 'artery', { radial: 8 }), 'vaso');

  // ── GLÁNDULAS ──
  // Parótida (caudal al masetero, ventral a la oreja)
  B('gl_parotida', blob(V(0.02, -0.06, 0.09), [0.03, 0.055, 0.016], 'gland', { noise: 0.06, detail: 3 }), 'glandula');
  // Conducto parotídeo (rodea ventral del masetero por la escotadura y sube).
  // Antes colgaba por debajo del borde mandibular (y≈−0.225) formando un bucle
  // rosa suelto FUERA del contorno; ahora bordea la escotadura pegado al hueso
  // (y≈−0.19) y sube por la cara, sin sobresalir del contorno de la cabeza.
  B('conducto_parotideo', tube([V(0.02, -0.11, 0.088), V(0.1, -0.165, 0.072), V(0.17, -0.165, 0.065), V(0.24, -0.09, 0.065), V(0.28, -0.05, 0.065)], 0.003, 'gland', { radial: 8, mat: { color: '#e59ab4' } }), 'glandula');
  // Gl. mandibular (ventral a la parótida, en el ángulo, hacia el espacio intermandibular)
  B('gl_mandibular', blob(V(0.04, -0.13, 0.06), [0.035, 0.025, 0.02], 'gland', { noise: 0.06, detail: 3 }), 'glandula');

  // ── LINFÁTICOS ──
  B('nl_parotideo', blob(V(0.04, -0.03, 0.09), [0.01, 0.012, 0.008], 'lymph', { noise: 0.05, detail: 2 }), 'linfa');
  B('nl_mandibular', blob(V(0.08, -0.14, 0.055), [0.012, 0.01, 0.009], 'lymph', { noise: 0.05, detail: 2 }), 'linfa');
  B('nnll_retrofaringeos_lat', blob(V(-0.01, -0.07, 0.07), [0.012, 0.012, 0.01], 'lymph', { noise: 0.06, detail: 2 }), 'linfa');

  // Oreja (contexto, piel)
  B(null, blob(V(-0.01, 0.06, 0.1), [0.02, 0.045, 0.01], 'skin', { noise: 0.05, detail: 3, mat: { opacity: 0.9, transparent: true } }), 'piel');
}

// ─────────────────────────────────────────────────────────────
// 10 · EXTERNO (hocico, plano nasolabial, ollares, piel de la cabeza)
// ─────────────────────────────────────────────────────────────
function buildExternal(P, B) {
  // Hocico desnudo (muzzle) — kind 'nose'
  P('hocico', blob(V(0.5, -0.02, 0), [0.03, 0.035, 0.05], 'nose', { noise: 0.03, detail: 3 }), 'piel');
  // Plano nasolabial (placa glandular oscura entre ollares y labio)
  P('plano_nasolabial', sheet([[0.5, 0.02], [0.52, 0.0], [0.5, -0.04], [0.47, -0.02], [0.47, 0.01]], 0.01, 'nose', { bevel: 0.002 }), 'piel');
  // Ollares (contexto)
  B(null, ring(V(0.5, 0.0, 0.03), V(1, 0, 0.2), 0.012, 0.004, 'nose'), 'piel');

  // Piel de la cabeza: del borde caudal (HEAD_SKIN_EDGE, x=-0.02, elipse
  // y +0.13..-0.24, semiancho 0.11) hasta el hocico. Envuelve el cráneo y la
  // mandíbula siguiendo el techo (top) y el borde ventral mandibular.
  // Se registra como CONTEXTO (ref null) porque 'piel' pertenece al módulo body.
  const skin = loft(
    [V(-0.02, -0.03, 0), V(0.06, -0.03, 0), V(0.18, -0.035, 0), V(0.3, -0.04, 0), V(0.42, -0.04, 0), V(0.5, -0.035, 0)],
    (t) => {
      const x = lerp(-0.02, 0.5, t);
      // techo un poco por encima del hueso; suelo justo bajo el borde mandibular
      const roof = SKULL.top(x) + 0.022;
      const floor = MANDIBLE.bodyVentral(Math.max(0.2, x)) + 0.01;
      const h = (roof - floor) / 2;
      const dy = (roof + floor) / 2;
      // semiancho: 0.11 en el borde caudal, se estrecha hacia el hocico
      const w = lerp(0.108, 0.052, Math.pow(t, 0.85));
      return { w, h, wTop: w * 0.88, wBot: w * 0.82, p: 2.6, dy };
    },
    'skin', { segs: 44, radial: 34, caps: false },
  );
  P(null, skin, 'piel');
}

// ─────────────────────────────────────────────────────────────
// 11 · PEQUEÑOS RUMIANTES (marcados en la posición equivalente)
// ─────────────────────────────────────────────────────────────
function buildSmallRuminant(P, B) {
  // Filtro del plano nasal (surco medio)
  P('filtro_nasal', pathLine([V(0.51, 0.005, 0), V(0.49, -0.03, 0)], 'projection2', 0.0025, { radial: 8 }), 'piel');
  // Gl. del plano nasal (ovino)
  P('gl_plano_nasal', marker(V(0.49, -0.01, 0.015), '#e59ab4', 0.006, 'gland'), 'glandula');
  // Gl. del seno infraorbitario (rostromedial al ojo)
  B('gl_seno_infraorbitario', blob(V(0.2, -0.005, 0.06), [0.01, 0.009, 0.008], 'gland', { noise: 0.04, detail: 2 }), 'glandula');
  // Gll. cornuales (caudomediales a la base del cuerno)
  B('gll_cornuales', marker(V(0.0, 0.1, 0.055), '#e59ab4', 0.007, 'gland'), 'glandula');
  // Barba (caprino): mechones bajo la mandíbula
  const barba = group();
  for (let i = 0; i < 6; i++) {
    const z = lerp(-0.03, 0.03, i / 5);
    barba.add(tube([V(0.3, -0.14, z), V(0.31, -0.2, z), V(0.3, -0.26, z)], 0.0025, 'horn', { radial: 6, mat: { color: '#6b5a45' } }));
  }
  P('barba', barba, 'piel');
}
