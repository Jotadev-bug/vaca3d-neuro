// ─────────────────────────────────────────────────────────────
// miembros.js · Módulo PRÁCTICA 11 · partes blandas de los miembros:
// músculos extrínsecos e intrínsecos, tendones digitales, vasos,
// linfonodos y nervios de los miembros torácico (11.5) y pelviano (11.6).
// ─────────────────────────────────────────────────────────────
import * as fore from './p11/forelimb.js';
import * as hind from './p11/hindlimb.js';

export function build() {
  fore.buildSoft();
  hind.buildSoft();
}
