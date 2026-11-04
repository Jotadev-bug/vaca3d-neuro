// ─────────────────────────────────────────────────────────────
// neck.js · Módulo CUELLO (owner 'neck')
// Esqueleto cervical (9.1.C), conformación + disección superficial (9.2.B)
// y disección profunda + cortes transversales de peq. rumiantes (9.4.B).
// Coordenadas MUNDO (sin transform de grupo).
// +X craneal · +Y dorsal (suelo y=0) · +Z lado izquierdo · metros.
// ─────────────────────────────────────────────────────────────
import { buildSkeleton } from './neck/skeleton.js';
import { buildSoft } from './neck/soft.js';
import { buildSkin } from './neck/skin.js';

export function build() {
  buildSkeleton();  // C1-C7, ligamento de la nuca, bolsa supraespinosa
  buildSoft();      // músculos, tráquea, esófago, vasos, nervios, tiroides, timo, nódulos
  buildSkin();      // papada y mamellas
}
