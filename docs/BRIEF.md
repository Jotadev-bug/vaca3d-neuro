# Common brief for model workers

Project: `C:\Users\jesus\.kiro\crew\workspace\vaca3d` (Vite 8 + three 0.187, plain JS ES modules). It is an interactive 3D study atlas of the COW for a veterinary anatomy exam ("Práctica 9 Rumiantes: cabeza, cuello, dorso y tórax"). The whole cow is built PROCEDURALLY in code (no external models). Four workers build four modules in parallel (head, neck, thorax, body); you own exactly ONE module.

## Read first (do NOT edit these shared files)
- `src/geo.js`: modeling API (place, both, mirrorZ, tube, blob, loft, sheet, patch, marker, ring, pathLine, area, group, makeMaterial, material kinds and layers).
- `src/frame.js`: shared anatomical frame and landmark coordinates. World axes: +X cranial, +Y dorsal, ground y=0, +Z = animal's LEFT side, metres, adult cow 1.4 m at withers.
- `src/data/structures.js`: study catalog. SECTIONS items are [number, name, ref]; INFO[ref] = [owner, description]; ALIASES.
- `docs/temario.md`: transcribed notes with positional hints from the textbook figures.
- If a frame value looks anatomically wrong for your module, work around it locally and REPORT it; do not edit frame.js.

## Contract
- Your file exports `export function build() {}` that creates meshes with geo.js helpers and registers them via `place(ref, obj, layer?, parent?)` / `both(ref, obj, layer?, parent?)` (both = object + mirror on the other side). ref = catalog id string; null = context mesh (visible, not selectable).
- Register EVERY ref whose INFO owner is your module. For ALIASES parents build the CHILD refs only (the parent highlights its children automatically) unless the parent also has its own INFO entry with your owner and a sensible own mesh. The same ref may be registered by several meshes (bilateral, multi-part).
- No DOM/canvas/document access inside build(): it must run in Node (scripts/check.mjs imports it).
- You may split code into helper files under `src/model/<module>/`. Do not touch other modules, main.js, scene.js, CSS or HTML.
- Point-like refs (foramina, palpable points, papillae, clinical sites) -> small marker()/ring() (size 0.004-0.014) sitting exactly on the correct surface; never giant spheres. Lines/borders/grooves -> pathLine() thin tubes along the actual feature (pass the layer explicitly if not 'proyeccion'). Every selectable thing must be visible from outside or in the relevant cut (sagittal clip at z=0 or a transversal clip).
- Visual quality matters a lot: the user wants a beautiful, clean, fully detailed model. Smooth organic forms (blob with low noise, loft with tapering, tubes with tapered radius functions r(t)), realistic relative sizes and colours via the material kinds, no z-fighting (offset overlapping layers by 1-3 mm), nothing poking out of the body. Triangle budget per module: head/thorax ~350k, body ~400k, neck ~250k.
- Anatomical accuracy: follow docs/temario.md plus veterinary anatomy knowledge (Dyce, König & Liebich, Popesko, Ashdown & Done). Topography and relationships matter more than micro-detail.

## Verification (mandatory, iterate)
1. `node scripts/check.mjs <module> --boxes` (cwd = project root): must print 0 missing refs for your owner and 0 NaN. Inspect the bounding boxes for sanity.
2. Screenshots: a Vite dev server is ALREADY running at http://127.0.0.1:5173 (do not start/stop it; it hot-reloads). Run `node scripts/shot.mjs "<query>" shots/<module>-<n>.png` then open the PNG with your file-reading tool and judge it critically. Query params:
   - `solo=<module>` render only your module (comma list allowed, e.g. `solo=head,neck`)
   - `view=completo|cabeza|corte_cabeza|cuello|torax_izq|torax_dcho|corazon|dorso`
   - `layers=piel,hueso,musculo,vaso,nervio,linfa,glandula,seno,cavidad,viscera,proyeccion` (subset)
   - `skin=0..0.6` skin opacity
   - `clip=sag:0` | `clip=tr:<x>` | `clip=dor:<y>` clip planes; add `&flip=1` to keep the other side
   - `sel=<ref>` highlights and frames a ref (verify placements)
   - `cam=x,y,z&target=x,y,z` free camera; `ui=0` hides UI panels
   Do at least 4-5 screenshot/fix rounds from different angles and several `sel=<ref>` checks. Other modules may not exist yet; use `solo=<module>` mainly. Delete nothing in shots/ that is not yours.
3. Final report (concise): refs implemented, triangle count, approximations, frame issues. Stop when everything is implemented and visually verified.
