# Module: neck -> src/model/neck.js (owner 'neck' in INFO)
Covers: cervical skeleton 9.1.C, neck conformation + superficial dissection 9.2.B, small-ruminant neck dissection and transverse cuts 9.4.B. World coordinates (no group transform).

## Key frame data
- CERVICAL (C1..C7 body centres).
- NECK_SKIN sections + NECK_SKIN_P: the body worker builds the neck skin from these sections; ALL your muscles/vessels must stay inside that envelope, superficial muscles 5-15 mm under it.
- NECK_DEWLAP.
- TRACHEA + TRACHEA_R: you build the CERVICAL trachea from TRACHEA[0] to TRACHEA[5] (thoracic inlet, x~0.32); the thorax worker continues.
- ESOPHAGUS + ESOPHAGUS_R: you build indices 0..5 (left-deviated mid-neck).
- JUGULAR: v_yugular_externa path (left; mirror for right), starting at JUGULAR_ORIGIN where the head worker converges v. maxilar + v. linguofacial.
- headToWorld(x,y,z) for head-local landmarks (SKULL, MANDIBLE): e.g. occipital protuberance ~ local (-0.02, 0.07, 0), mastoid region ~ local (0.02, -0.05, 0.08), mandible ventral border at the masseter rostral edge ~ local (0.18, -0.22, 0.06), basihyoid ~ local (0.10, -0.21, 0), thyroid cartilage ~ PHARYNX.larynx.
- SCAPULA (cranialAngle, neck, shoulderPoint), STERNUM[0] (manubrium).
- THORACIC T1..T3 for the withers: spinous tip = THORACIC[i] + (-sin(tilt)*h, cos(tilt)*h) with THORACIC_SPINE_H / THORACIC_SPINE_TILT (the body worker builds those spines).

## What to build (neck-owned refs; read INFO descriptions)
- vertebras_cervicales: C3-C7 detailed (body with cranial head/caudal fossa, arch, spinous processes increasing caudally, articular processes, C6 broad ventral lamina, C7 tall spine). Transverse processes of C3-C7 as separate meshes ref ap_transversas_cervicales. atlas (C1 body/arches) + ala_atlas (wide flat wings, separate ref) + ag_alar (ring on the wing). axis (C2: long body, dens, high long spinous crest).
- lig_nuca children: cordon_nuca (paired cord from the occipital protuberance to the withers spinous tips, kind 'ligament'), laminas_nuca (sheet from the cord down to C2-C7 spines). bolsa_supraespinosa (small bursa under the cord at T1-T2 tips).
- Muscles (both sides): m_trapecio (cervical part: thin triangular sheet from nuchal ligament/withers to the scapular spine), m_cleido_occipital and m_cleido_mastoidea (two bellies of the cleidocephalic from the clavicular intersection cranial to the shoulder joint up to the nuchal crest / mastoid region; dorsal border of the jugular groove), m_esterno_mandibular (superficial, manubrium -> mandible ventral border rostral to the masseter) and m_esterno_mastoidea (deeper, to the mastoid region): ventral border of the groove. m_omohioideo (thin, deep to the jugular, shoulder fascia -> basihyoid), m_esternohioideo (ventral midline strap over the trachea), m_esternotiroideo (lateral/deep to it, to the thyroid cartilage). Bellies: flattened tapered lofts/patches with gentle curvature, separated by a few mm.
- surco_yugular: groove line (pathLine, kind 'projection2') on the surface over the jugular between cleidocephalic and sternocephalic.
- v_yugular_externa (both sides along JUGULAR, r ~0.012 tapering), a_carotida_comun (both sides, dorsolateral to the trachea from the thoracic inlet up to near the larynx, r ~0.007), tronco_vagosimpatico (dorsal to the carotid, nerve, r ~0.003), n_laringeo_recurrente (ventrolateral along the trachea to the larynx), n_accesorio (dorsal branch under the cleidocephalic to the trapezius).
- traquea (cervical: tube with visible cartilage rings every ~2 cm), esofago (cervical muscular tube).
- gl_tiroides (two lobes lateral to the first tracheal rings just caudal to the larynx + isthmus), timo_cervical (lobulated pale strands along the trachea, cranial/mid neck, modest).
- Lymph nodes: nl_cervical_superficial (large ~6x2.5 cm, cranial to the scapula/shoulder joint under the cleidocephalic, ~(0.40, 1.05, ±0.20), stay inside skin), nnll_cervicales_craneales (near thyroid/larynx), nnll_cervicales_medios (mid-neck along trachea), nnll_cervicales_caudales (near the thoracic inlet).
- papada (dewlap: thin hanging skin sheet in the median plane along NECK_DEWLAP, kind 'skin', layer 'piel', thicker at the free border, joining the ventral neck skin) and mamellas (two small teardrop skin appendages, ventral cranial neck).

## Checks
Transverse cuts like the textbook at C4 and C7 (`clip=tr:<x of C4>` / `<x of C7>`): trachea ventral midline, esophagus dorsal-left, carotid + vagosympathetic trunk dorsolateral, recurrent laryngeal near trachea, external jugulars lateral subcutaneous, sternocephalic portions ventrolateral, omohyoid, vertebra centred. E.g. `solo=neck&clip=tr:0.70&cam=0.95,1.0,0.0&target=0.70,1.0,0&ui=0`. Also `solo=neck&view=cuello&skin=0`, `solo=neck,head&view=cuello`, `solo=neck&view=cuello&layers=hueso,musculo&skin=0`, `solo=neck&sel=nl_cervical_superficial`.
