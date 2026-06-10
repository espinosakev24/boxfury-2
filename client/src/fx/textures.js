import Phaser from 'phaser';

/**
 * Generate the shared FX textures. Called first thing in GameScene.create().
 * Every key is exists-guarded: the Phaser.Game is destroyed after each match
 * (main.js game.destroy(true)), so textures must be re-creatable per run.
 * All textures are white — color comes from setTint/particleTint at use.
 */
export function ensureFxTextures(scene) {
  if (!scene.textures.exists('fx-px')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('fx-px', 4, 4);
    g.destroy();
  }

  if (!scene.textures.exists('fx-line')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 2);
    g.generateTexture('fx-line', 8, 2);
    g.destroy();
  }

  if (!scene.textures.exists('fx-ring')) {
    // 60x90 box outline matching the spawn-pulse ring, baked at 3x and
    // rendered at scale 1/3: rings tween up to ~4.7x screen magnification
    // (scale 2.6 x zoom 1.8) and NEAREST filtering would turn a 1x stroke
    // into chunky texel stairs.
    const g = scene.make.graphics({ add: false });
    g.lineStyle(9, 0xffffff, 1);
    g.strokeRoundedRect(6, 6, 180, 270, 6);
    g.generateTexture('fx-ring', 192, 282);
    g.destroy();
  }

  if (!scene.textures.exists('fx-tick')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 8);
    g.generateTexture('fx-tick', 1, 8);
    g.destroy();
  }

  if (!scene.textures.exists('fx-glow')) {
    // Radial falloff — the ONLY linear-filtered texture in the game.
    // Never flip global pixelArt; the filter is set per-texture here.
    // Guarded like the rest: createCanvas returns null on a duplicate key.
    const size = 64;
    const canvasTex = scene.textures.createCanvas('fx-glow', size, size);
    if (!canvasTex) return;
    const ctx = canvasTex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvasTex.refresh();
    canvasTex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
