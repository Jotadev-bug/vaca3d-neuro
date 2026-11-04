# Ronda de pulido (visual)

Proyecto: `C:\Users\jesus\.kiro\crew\workspace\vaca3d` (Vite + three). Dev server ya en marcha en http://127.0.0.1:5173 (no lo arranques ni lo pares).
Contexto: `docs/BRIEF.md`, `docs/brief-<tu módulo>.md`, `docs/temario.md`, `src/frame.js`, `src/geo.js`.

## Reglas
- Edita SOLO tu módulo: `src/model/<módulo>.js` y, si existe, `src/model/<módulo>/`. No toques geo.js, frame.js, scene.js, main.js, structures.js ni otros módulos. Si un archivo compartido necesita cambio, escríbelo en tu informe.
- Mantén TODAS las refs registradas (mismos ids y owner). `node scripts/check.mjs <módulo>` debe dar 0 sin malla, 0 NaN.
- Presupuesto de triángulos de tu módulo: no más de +30 % del actual.
- `blob()` ya genera normales suaves (icosaedro indexado). Usa `detail` 3-4; 5 solo en piezas grandes.
- Nada de placas/cajas planas para órganos o cavidades: formas orgánicas (blob con deform, loft, tube).
- Coherencia: todo lo profundo dentro de la piel; nada que atraviese huesos sin motivo; lados izq (+z) y dcho (-z) simétricos salvo asimetrías reales.

## Verificación visual (obligatoria, mínimo 4 rondas)
`node scripts/shot.mjs "<query>" <salida.png>` y lee el PNG. Guarda las capturas en tu `$KIROCREW_SCRATCH` (no en el proyecto).
Ejemplos: `view=cabeza`, `view=cuello`, `view=torax_izq`, `view=torax_dcho`, `view=corazon`, `view=completo`, `solo=head&view=cabeza`, `sel=<ref>`, `view=cabeza&skin=0`, `view=cabeza&layers=hueso`, `view=corte_cabeza`, `cam=x,y,z&target=x,y,z`.
Ejes: +X craneal, +Y dorsal, +Z izquierda, metros.

## Informe final (breve)
Qué cambiaste, triángulos antes/después, salida de check.mjs, problemas pendientes o de archivos compartidos.
