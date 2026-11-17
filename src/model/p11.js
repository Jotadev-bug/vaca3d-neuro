// ─────────────────────────────────────────────────────────────
// p11.js · Módulo PRÁCTICA 11 (vacuno): pelvis ósea y vísceras pélvicas,
// genitales femeninos, ubre y ESQUELETO de los miembros (con dedos y
// pezuñas). Los músculos, tendones, vasos y nervios de los miembros van
// en `miembros.js` y los genitales del toro en `toro.js`, para que las
// vistas de las prácticas 9 y 10 puedan prescindir de ellos.
// ─────────────────────────────────────────────────────────────
import * as pelvis from './p11/pelvis.js';
import * as fore from './p11/forelimb.js';
import * as hind from './p11/hindlimb.js';

export function build() {
  pelvis.build();
  fore.buildSkeleton();
  hind.buildSkeleton();
}
