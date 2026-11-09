# Asset licenses and attribution

INDRA 0.0.3 ships every runtime 3D model locally in `assets/glb/`. No model is
downloaded from a third-party server while the application is running.

## Factory hardware — Kenney Factory Kit 3.0

- Source: https://kenney.nl/assets/factory-kit
- Author: Kenney (https://kenney.nl)
- License: Creative Commons Zero 1.0 Universal (CC0 1.0)
- License text: https://creativecommons.org/publicdomain/zero/1.0/
- Pack version: 3.0 (pack creation date shown by the publisher: 2026-05-01)
- Downloaded: 2026-11-09
- Attribution is not required by the license. Credit is retained here as a
  courtesy to the author.

Files used:

| Local file | Kenney source file | Used for |
|---|---|---|
| `material-source.glb` | `hopper-square.glb` | Raw material source |
| `workstation.glb` | `machine-window.glb` | Workstation / machine |
| `inspection.glb` | `scanner-high.glb` | Inspection station |
| `conveyor.glb` | `conveyor-long.glb` | Conveyor belt |
| `buffer.glb` | `box-wide.glb` | Buffer storage |
| `output-bin.glb` | `box-large.glb` | Finished goods bin |
| `control-panel.glb` | `screen-panel-wide.glb` | HMI / control panel |
| `Textures/colormap.png` | `Models/GLB format/Textures/colormap.png` | Shared palette texture |

The models are renamed only. At load time INDRA normalises their uniform scale,
grounds them at Y=0 and optionally applies the rotation recorded in
`src/data/assetManifest.js`. The shared Kenney palette texture is bundled and
resolved by the loader's URL modifier.

## Worker — Quaternius animated character

- Model: `worker.glb` (Soldier_Male)
- Original author: Quaternius (https://quaternius.com)
- Distribution/mirror: Cinevva free CC0 character library
  (https://app.cinevva.com/game-assets/free-3d-character-models)
- Direct download used:
  `https://cdn.cinevva.com/assets/packs/quaternius/ultimate-animated-characters/Soldier_Male.glb?download=1`
- License: Creative Commons Zero 1.0 Universal (CC0 1.0)
- License text: https://creativecommons.org/publicdomain/zero/1.0/
- Downloaded: 2026-11-09
- Animation clips included: Idle, Walk, Run, Walk_Carry, Run_Carry, PickUp,
  Punch, Jump, Death, Defeat, RecieveHit, Roll, Shoot_OneHanded, SitDown,
  StandUp, SwordSlash, Victory.

INDRA uses the embedded animation clips to show idle, working and unavailable
worker states. The model is cloned for additional workers with
`three/examples/jsm/utils/SkeletonUtils.js`; only one network request is made
for the source GLB.

## Asset integrity

The browser loads GLBs from the Vite-bundled URLs generated from
`assets/glb/*.glb`. `tests/unit/assets.test.js` verifies that every required
file is present, non-empty and declared with a CC0-compatible license.
