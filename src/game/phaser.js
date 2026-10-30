// The part of Phaser the game uses (SPEC §2): the core – game, scenes,
// cameras, input, scale, textures, tweens, time, and images / graphics / text –
// plus the three helpers GameScene needs. No physics, tilemaps, particles or
// sound (sounds come from sound.js), which roughly halves the download.
// vite.config.js folds Phaser's feature flags (typeof WEBGL_RENDERER …) so the
// unused renderer bits and the sound system drop out of the build.

import Phaser from 'phaser/src/phaser-core.js';
import Clamp from 'phaser/src/math/Clamp.js';
import BetweenPoints from 'phaser/src/math/distance/DistanceBetweenPoints.js';
import Point from 'phaser/src/geom/point/Point.js';

Phaser.Math.Clamp = Clamp;
Phaser.Math.Distance = { BetweenPoints };
Phaser.Geom = { Point };

export default Phaser;
