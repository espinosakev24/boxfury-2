# BOXFURY Visual Overhaul — Master Plan

**Status:** Approved art direction. This document merges the environments / vfx / gamefeel / presentation / performance specialist designs into one prioritized plan. All file paths are real; all Phaser APIs verified against Phaser 3.87 and the current codebase audit.

---

## 1. Art Direction Statement

**Minimal geometry, maximal atmosphere.** Boxfury stays a flat, Swiss-brutalist game of bone-white lines on deep navy — but the world stops being inert. Atmosphere comes from four sources only: **geometry** (parallax silhouette bands built from rects and triangles, ruler ticks, corner brackets), **light as an event** (brief team-colored pulses on shots, hits, kills, captures — never ambient glow), **motion** (squash/stretch, trauma camera, 80–320ms UI eases, 1–2s ambient loops), and **color** (per-map hue-shifted "color scripts" of the deep-navy void, with the locked 4-player palette as the only saturated thing on screen). Nothing is painted; everything derives from the token set; the only sanctioned soft effect is the transient combat glow texture and the damaged-state inset stroke.

**The readability contract — these may NEVER be obscured or removed at any quality tier:**
- Player silhouettes and team colors (jade `#4ee08a` / crimson `#ff5470` / azure `#4eb1ff` / amber `#ffd84e` are IFF signals)
- Arrows (the lethal object, depth 20, always the sharpest element on screen)
- The bone arena lines / platforms (collision truth)
- Hit white-flash, spawn-shield presence, flag-carrier indication, spawn pulse, death animation (gameplay information, on at every tier)
- The center 60% of the screen stays HUD-free; backgrounds never exceed luminance `#2a2a3a`; players/arrows/platforms stay the brightest pixels

**Token source of truth (resolve the drift now, before any theme work):** the game standardizes on `--bf-void #15151f` (canvas/scrim background — what CLAUDE.md calls "deep"), `--bf-deep #1a1a26` (panel surface), `--bf-arena #1f1f2c`, `--bf-bone #f5f5f0`, `--bf-line #2a2a3a`, `--bf-mute #4a4a5e`. These values are baked once into `shared/themes.js` as the canonical hex table; all three render surfaces (Level.js, map-picker.js, map-editor.js) and all new CSS read from it / from CSS custom properties — **no new hardcoded hexes anywhere**.

---

## 2. Visual Architecture

Six systems, all created **per GameScene instance** — the Phaser.Game is constructed in `doStartGame()` (`client/src/main.js:111-127`) and destroyed with `game.destroy(true)` (`main.js:136`) on every match, so textures, emitters, and pipelines must be (re)registered in `GameScene.create()`, never at module scope.

### 2.1 Theme system — `shared/themes.js` (new)

Dependency-free ESM, re-exported from `shared/index.js`. Zero protocol changes: `mapId` already syncs via Colyseus state (`GameRoom.js:58`) and `getMap()`'s raw-string contract / `parseMap()`'s return shape stay untouched, so the server never sees themes.

```js
export const THEMES = { arenaPrime: {...}, summit: {...}, mantle: {...}, strata: {...} };
export const MAP_THEMES = { default:'arenaPrime', twinRaise:'summit', tunnels:'mantle', islands:'strata' };
export function getTheme(mapId) { /* falls back to 'arenaPrime' */ }
export function toCssHex(int) { /* shared by Level.js, map-picker.js, map-editor.js */ }
```

Theme shape:

```js
{
  name, sky: { top, bottom }, lineColor, solidColor, solidEdge, accent,
  layers: [{ kind:'ridge'|'skyline'|'blocks'|'columns'|'trunks'|'panels',
             color, alpha, scrollFactor, seed, blink?, drift? }],
  ambient: { kind:'snow'|'embers'|'motes'|'leaves'|null, color, count, gravityY, speedX, alpha, lifespan },
  dressing: { ticks?, cornerMarks?, glowBand? }
}
```

Consumed by `Level` (constructor + `rebuild()`, `client/src/entities/Level.js:5-33`): `this.theme = getTheme(mapId)`; platform color comes from `theme.lineColor` instead of hardcoded `COLORS.BONE` (`Level.js:50,56`); `this.scene.cameras.main.setBackgroundColor(theme.sky.top)` in `applyBounds` (`Level.js:35-40`) since the global config color (`main.js:114`) can't vary per map.

### 2.2 Parallax layer manager — `client/src/entities/Backdrop.js` (new)

Instantiated by `Level`, rebuilt/destroyed inside `Level.rebuild()` and via `GameScene._teardownEntities` (`GameScene.js:297-311`) so reconnects don't leak.

- **Gradient sky quad:** one Graphics rect covering map bounds (`map.pixelWidth × map.pixelHeight`) at depth **-100**, drawn with `Graphics.fillGradientStyle(sky.top, sky.top, sky.bottom, sky.bottom, 1)` — WebGL-only, so guard with `scene.renderer.type === Phaser.WEBGL` and fall back to a flat mid-blend fill (config is `Phaser.AUTO`, a Canvas path exists).
- **Silhouette bands:** one Graphics per `theme.layers` entry, drawn **once** per rebuild (never per-frame — the postupdate redraw path is already the hot path), seeded deterministically via the FNV-1a + mulberry32 pattern from `entities/cracks.js`. `setScrollFactor(layer.scrollFactor, 1)`, `setDepth(-30 + index)`. Layer width: `w = viewW + (map.pixelWidth - viewW) * scrollFactor` where `viewW = WORLD.WIDTH / GAME.ZOOM ≈ 711`. All shapes are rects + triangles + `fillRoundedRect` radius 2; **≥2px strokes only** (pixelArt:true at zoom 1.8 makes 1px background lines shimmer).
- **Animated accents:** blink dots / cloud drift / beacon sweep are tiny separate Graphics animated by whole-object tweens (`alpha` yoyo with `Stepped` ease for the steps(2) blink, `x` drift ±40px over 10–14s Sine.easeInOut) — never clear+redraw. Max **3 concurrent ambient tweens per theme**, all at scrollFactor < 0.7. Tweens registered in an array and killed in `Backdrop.destroy()`.
- **Ambient weather:** one pooled ParticleEmitter (from FxManager, §2.3) tinted by `theme.ambient.color`, emit zone = `Phaser.Geom.Rectangle` ~800×520 recentered on `cameras.main.midPoint` via a one-line `backdrop.update()` called from `GameScene.update()`. Depth **-5**.
- `backdrop.update()` is the only per-frame work, and it's one rectangle recenter.

### 2.3 VFX/particle manager — `client/src/fx/textures.js` + `client/src/fx/FxManager.js` (new)

**`textures.js`** exports `ensureFxTextures(scene)`, called first in `GameScene.create()`, guarded by `scene.textures.exists()` (mandatory — textures die with the per-match `game.destroy(true)`):

| Key | Content | Filter |
|---|---|---|
| `fx-px` | 4×4 white rect via `this.make.graphics({add:false}).fillRect().generateTexture('fx-px',4,4)` then `.destroy()` | NEAREST (default) |
| `fx-line` | 8×2 white rect (sparks) | NEAREST |
| `fx-ring` | 60×90 stroked 2px rounded rect (pooled spawn-pulse / shockwave rings) | NEAREST |
| `fx-tick` | 1×8 bone tick (arena dressing) | NEAREST |
| `fx-glow` | 64×64 radial falloff via `scene.textures.createCanvas` + `ctx.createRadialGradient` + `refresh()` | **LINEAR via `texture.setFilter(Phaser.Textures.FilterMode.LINEAR)` — the ONLY linear-filtered texture; never flip global `pixelArt`** | HIGH tier only |

**`FxManager.js`** is the single facade for all bursts. In `GameScene.create()` it builds ~6 persistent emitters via the Phaser 3.60+ API `this.add.particles(0, 0, 'fx-px', config)` with `emitting:false`, all at **depth 18** (above bodies 10–13, below trail 19 / arrows 20 — this fixes the existing bug where particles render at depth 0 *behind* players):

```js
fx.burst(x, y, count, tint)      // radial hit burst — emitter.particleTint = tint; emitter.explode(count, x, y)
fx.cone(x, y, angle, count, tint)// directional splash — setConfig angle before explode
fx.dust(x, y, count)             // gravityY 300, low alpha
fx.sparks(x, y, angle, count)    // 'fx-line', blendMode Phaser.BlendModes.ADD, rotate follows velocity
fx.debris(x, y, count, tint, dirX, dirY) // death shards — gravityY 600, rotate {min:-180,max:180}
fx.muzzle(x, y, angle, tint)     // glow pop 70ms + sparks cone (glow HIGH only)
fx.ring(x, y, tint)              // pooled 'fx-ring' Images, scale 0.3→1.4 / 260ms — replaces create/destroy spawnPulse rects
fx.deathBurst(x, y, tint, dir)   // debris explode(12) + 200ms glow flash (glow HIGH only)
```

The existing `spawnArrowSplash` / `spawnLandingDust` / `spawnHitParticles` (`GameScene.js:659-725`) keep their signatures but delegate to `fx.*`, so all entity call sites (`Player.js:134/349/457`, `Arrow.js:59`, `handleHit`) are untouched. Every count is multiplied by the tier multiplier (§2.4); `maxAliveParticles` caps per emitter (§7). **Canvas fallback:** ParticleEmitter and ADD blend (`globalCompositeOperation 'lighter'`) both work on the Canvas renderer; only glow textures and postFX are skipped.

**Always set `particleTint` immediately before `explode()`** — a stale tint sprays the wrong team color, which is identity damage.

### 2.4 Quality tier system — `client/src/fx/quality.js` (new)

```js
export function detectQualityTier()  // 'high' | 'medium' | 'low'
export function getQuality()
export function canAddPostFX(scene)  // renderer.type === Phaser.WEBGL && tier === 'high'
export const COUNT_MULT = { high: 1, medium: 0.5, low: 0 /* per-category, see §7 */ };
```

- HIGH if `body.is-desktop` (set by `detectDevice()`, `main.js:24-33`); MEDIUM if `body.is-mobile`; demote one tier if `navigator.hardwareConcurrency <= 4` or `navigator.deviceMemory <= 4`; LOW if Canvas renderer or `matchMedia('(prefers-reduced-motion: reduce)')` (currently ignored entirely by the app — this adds it).
- Manual override persisted in localStorage key `'boxfury:quality'` (same pattern as `'boxfury:skin'`), surfaced as a 3-option row in `settings.js`.
- Plumbed exactly like `connectOptions`: `game.registry.set('quality', detectQualityTier())` in `doStartGame()`; `GameScene.create` reads once into `this.quality`. Decided once per game start — no per-frame branching beyond integer compares. **Never promote mid-match** (governor may demote, §2.6).

### 2.5 Camera controller — `client/src/fx/CameraFx.js` (new)

One controller owns **all** `setFollowOffset` and zoom writes so trauma, kick, and lookahead compose instead of fighting (this merges the gamefeel trauma camera with the presentation lookahead — both wanted followOffset). Instantiated in `GameScene.create()`, ticked at the top of `GameScene.update()`.

```js
camFx.addTrauma(amount)            // 0..1, capped at 1.0, linear decay 1.4/s
camFx.kick(dirX, dirY, px)         // exp decay, half-life 90ms
camFx.setAim(rot, pull)            // lookahead target, lerp 0.08, clamp ~52px
camFx.punchZoom(mult, inMs, outMs) // cam.zoomTo wrappers, self-canceling
camFx.reset()                      // zero everything — called in enterDeath/exitDeath/spectator/shutdown
```

Per frame: `offset = lookahead + noise * trauma² * 6 + kick`, applied via `cam.setFollowOffset(-x, -y)` — composes cleanly with the existing `startFollow` lerp 0.12 (`GameScene.js:766-773`). Noise = two desynced sines (`sin(t*0.043)`, `sin(t*0.059)`). **No camera rotation, ever.** Final offset × 0.5 on `is-mobile`, × 0 under `prefers-reduced-motion`. Replaces the lone hardcoded `shake(140, 0.006)` at `GameScene.js:655`. Skip lookahead/charge zoom when `this.isSpectator || this.deathState`.

Trauma sources: take hit +0.35 · deal kill +0.25 · own death +0.5 · full-charge shot +0.06 · hard landing (impactVy > 520) +0.08 · nearby arrow impact +0.05–0.15 by distance. Kick: hit = `normalize(knockX,knockY)*8px`; shot recoil = `-shotDir*3px`.

### 2.6 Frame governor — `client/src/fx/perf.js` (new)

Samples `this.game.loop.actualFps` into a rolling 3s window at 4Hz. Mean < 50fps for 3 consecutive seconds → demote the live tier one step, dispatch `window` CustomEvent `'boxfury:quality'` (mirrors the `'boxfury:mute'` pattern, `main.js:86`); FxManager/Backdrop/postFX react (`cameras.main.postFX.clear()` on demotion). Never promotes. `?perf=1` mounts a fixed DOM JetBrains Mono readout at 4Hz: `actualFps`, live particle counts per emitter, tier, and postupdate ms (a `performance.now()` bracket around the postupdate handler).

### 2.7 Redraw scheduler (modify existing entities)

The dominant existing cost is full clear+restroke on `postupdate` (legs × N players, bows, shield, flag, bee, trails). Two mechanisms, no framework:

- **Dirty flags** where output is deterministic: legs hash `(mode, phase quantized to 24 steps, facing)` and skip when unchanged (idle players currently restroke identical polylines 60×/s); bow skips when not aiming and quantized pull/angle unchanged.
- **Hz caps** via a shared `this.frameNo++` on GameScene: SpawnShield / Flag cloth / Bee wings redraw every 2nd frame on MEDIUM, every 3rd on LOW. `syncSpawnShields` and `syncFlag` full-roster polls run every 2nd frame on MEDIUM/LOW (33ms latency is invisible). Combat-critical redraws (hit flash, bow while charging, live arrow trails) stay 60Hz on all tiers.
- Hold-Tab scoreboard: signature-string check before `innerHTML` rebuild.

### 2.8 Static dressing bake — `Level.js` (modify)

Decision rule: **static for the whole match → RenderTexture; animated → live object.** In `Level.build()`: `this.bgLayer = scene.add.renderTexture(0, 0, map.pixelWidth, map.pixelHeight).setOrigin(0).setDepth(-5)`; draw ruler ticks, corner brackets, themed solid-block edges into a throwaway Graphics, `rt.draw(gfx)`, `gfx.destroy()`. Rebaked in `Level.rebuild()`. Phaser Graphics re-submits its full command list every frame even when unchanged; a RenderTexture is one textured quad. Largest map (tunnels 1440×1920) ≈ 11MB VRAM — acceptable. LOW tier skips the bake. Backdrop silhouette bands ship as drawn-once Graphics first (2–4 draw calls); promote to RTs only if `?perf=1` shows > 0.5ms.

---

## 3. Map Themes

Four shipped themes + two ready for future maps. All backgrounds are hue-rotations of `#15151f / #1f1f2c` toward one player-color anchor; luminance stays in the `#15–#33` band; environment use of jade/crimson is darkened derivatives or alpha ≤ 0.25.

### ARENA PRIME → `default` (sci-fi arena, the canonical look)
- Sky `#15151f → #1f1f2c` · line `#f5f5f0`
- Far: blueprint grid, 2px lines `#2a2a3a` α0.4, sf 0.15
- Mid: stadium-stand skyline rects `#1a1a26` sf 0.35, with 1px amber `#ffd84e` window dots α0.25 blinking (800ms stepped alpha-yoyo)
- Near: ruler ticks `#4a4a5e` under the main floor line + 12×12 corner brackets (ported from the design ref, `screen-match.jsx:96-116` / `screen-menu.jsx:162-180`)
- Ambient: motes `#8a8a9e` α0.12

### SUMMIT → `twinRaise` (frozen — the pyramid map IS a mountain)
- Sky `#15151f → #232840` · line `#f5f5f0`
- Far: ridge `#1b1e30` sf 0.1; second ridge `#232840` sf 0.25
- Mid: 2–3 cloud bars (long `fillRoundedRect` r2) bone α0.08 sf 0.4, drifting ±40px / 12s
- Ambient: **snow** — bone-tinted fx-px, 30 desktop / 12 mobile, `speedY {min:8,max:18}`, lifespan 9000
- Dressing: 2px `#ffffff` α0.5 top edge on solid blocks = snow caps (`theme.solidEdge`)

### MANTLE → `tunnels` (volcanic — the deep cavern map)
- Sky `#15151f → #2b1620` · line `#f5f5f0`
- Far: stalactite/stalagmite ridge pairs `#1c1420` sf 0.2
- Bottom glow band: crimson `#ff5470` gradient α 0.08→0 rising from map floor (~6 tiles), heat-shimmer alpha pulse 0.06↔0.1 / 2.4s
- Ambient: **embers** rising — tint mix `#ff5470`/`#ffd84e`, 24/10, negative speedY, scale 1→0.3

### STRATA → `islands` (floating sky islands)
- Sky `#15182a → #232a44` · line `#f5f5f0`
- Far: 'blocks' island silhouettes (rect + inverted-triangle underside) `#1b2138` sf 0.12; second layer `#232a44` sf 0.3
- Mid: cloud bars bone α0.06 sf 0.45 · below-floor void fade to `#0e0e16`
- Ambient: azure `#4eb1ff` motes drifting up, α0.2

### Future maps (data-ready, ship with new maps)
- **FOUNDRY** (industrial): sky `#15151f → #251a2e`; skyline+chimneys `#1a1a26` sf 0.15 with alternating `#ff5470`/`#4eb1ff` blink dots α0.3; 2px gantry lines `#2a2a3a` sf 0.35; amber sparks rising ×16; optional beacon sweep (2×40px bone α0.15 line, rotation tween 360°/6s)
- **CANOPY** (forest temple): sky `#121a16 → #1c2a20`; trunks `#16201a` sf 0.15; temple steps + ≥2px vine polylines sf 0.35; 2–3 skewed bone rects α0.04 sf 0.5 as geometric light shafts (alpha pulse 0.03↔0.06 / 4s); jade `#4ee08a` 2×2 rotating leaf squares 18/8

Each theme ≈ 20 lines of data in `shared/themes.js`. The map picker (`client/src/map-picker.js:80-122`) drops its hardcoded hexes for `getTheme(mapId)` + `ctx.createLinearGradient` thumbnails with 3–4 sampled silhouette rects.

---

## 4. Effects Catalog

Depth bands: backdrop −100…−5 · world 0 · stuck arrows 9 · player 10–13 · bow/name 14 · shield 15 · bubble 16 · **all particles/FX 18** · trail 19 · arrows 20 · screen-space 50. Blend `ADD` = `Phaser.BlendModes.ADD`.

| Effect | Trigger | Technique | Blend | Budget (count, H tier) | Off at tier |
|---|---|---|---|---|---|
| Hit burst | `handleHit` (`GameScene.js:634-657`) | `fx.burst` explode(8), target tint | NORMAL | 8 (cap 48 alive) | never (12 min on LOW) |
| Directional sparks | `handleHit`, reflected along `knockX/Y` | `fx.sparks` explode(3), fx-line | ADD | 3 (cap 24) | LOW |
| Impact flash | `handleHit`, synced to `flashHit` (`Player.js:275`) | fx-glow sprite pop, scale 0.5→0.9 / 90ms | ADD | 1 sprite | MEDIUM, LOW (flat white flash remains) |
| Kill camera punch | `payload.alive===false` in `handleHit` | `camFx.addTrauma(0.25)` + `cam.zoomTo(GAME.ZOOM*1.045, 60, 'Sine.easeOut', true)` → back 180ms | — | — | never (halved mobile) |
| Kill-confirm ring | kill && `shooterId === network.sessionId` | `fx.ring` victim color, 36×60 → ×2.2 / 280ms Cubic.easeOut + layered SFX `body-hit {rate:0.8}` | ADD | 1 pooled image | never |
| KillShockFX | same, HIGH desktop only | custom `PostFXPipeline` (`fx/KillShockFX.js`): radial UV offset + 1.5px RGB split from kill point, uniforms uTime/uStrength, tween 1→0 / 160ms, `removePostPipeline` after; registered via `renderer.pipelines.addPostPipeline` **every match** | — | 1 pass ×160ms | MEDIUM, LOW, Canvas |
| Hitstop | local hit / local kill | `fxTimeScale` 0.3×/50ms, 0.15×/90ms; `physics.world.timeScale = 1/s`, `tweens.timeScale = s`; **arrows stay on real dt**; single `performance.now()` deadline, never stacks | — | — | never (it's free) |
| Death shatter | `syncDeath` (`GameScene.js:979-1028`) | `fx.deathBurst`: debris explode(12), 5 player-color + 2 bone, biased along cached kill direction, gravityY 600, life ≤ 700ms; white body hold 60ms before topple; `drawDeadFace` (two 1px X strokes) in `faces.js` | NORMAL | 12 (cap 24) | LOW (topple + X-face stay) |
| Bee death | bee branch of `syncDeath` (`GameScene.js:1002`) | `fx.burst` explode(6) amber + 60ms glow pop (glow HIGH) | NORMAL | 6 | never |
| Arrow trail | live arrow | follow-emitter `startFollow(sprite)`, lifespan 200, scale 0.7→0, freq 14ms (28ms M) — replaces per-frame Graphics (`Arrow.js:119-136`) | ADD | ~14/arrow | LOW → keep Graphics trail, 4 pts, `setBlendMode(ADD)` |
| Arrow tip glow | live arrow, in `Arrow.update` | fx-glow Image at head, α0.3, scale 0.25, destroyed in `Arrow.destroy` | ADD | 1/arrow | MEDIUM, LOW |
| Muzzle flash + recoil puff | `arrows.onAdd` (`GameScene.js:250-258`) — fires for local AND remote shooters | `fx.muzzle`: glow pop 70ms (HIGH) + sparks cone explode(4) along fire angle | ADD | 4 | puff off LOW |
| Shot recoil | end of `Player.releaseBow` (`Player.js:397`) + same `arrows.onAdd` for remotes | `_resetScaleTweens()` then scaleX 0.92/scaleY 1.06, 60ms Quad.easeOut yoyo; bow `_recoil = -0.1*pull` → 0 / 120ms Expo.easeOut; `camFx.kick(-shotDir, 3)` | — | — | never |
| Bow charge tell | `Bow._draw` (shared by Player/RemotePlayer) | limb tension: `bulge *= (1 - 0.3*pull)`, lineStyle width `2 + pull`; nock glow fx-glow scale `0.15 + 0.45*pull` α`0.3*pull` tint player color (HIGH/MED); at pull ≥ 0.97 blinking 2×2 bone nock dot via `Math.floor(now/125)%2` (ALL tiers) | ADD (glow) | 1 sprite/player | glow off LOW; dot never |
| Full-charge sparks | pull ≥ 0.95 | 2 sparks / 130ms at nock, timestamp-throttled | ADD | ~7/s | MEDIUM, LOW |
| Landing dust / turn dust | `Player.js:134/349/457` | `fx.dust` (existing hooks, now pooled) | NORMAL | 4–8 (cap 32) | LOW |
| Hard-landing impact | `playLandingSquash`, impactVy > 520 | white leg flash 50ms; 2 bone 2px floor-shockwave rects width 4→26 / 160ms Quad.easeOut; `camFx.addTrauma(0.08)` + 2px down kick; same frame as `player-landing` SFX | NORMAL | 2 rects | shockwave off MEDIUM/LOW |
| Spawn pulse | `spawnPulse` (`GameScene.js:791-804`) | pooled `fx.ring` + **team-colored** `cameras.main.flash` (decompose color int — replaces gray `flash(220,80,80,80)` at `:794`) | — | 1 | never |
| Crack-stage punctuation | stage increase in `setDamageFromHp` (`Player.js:191`) | cracks drawn BONE for 60ms (`delayedCall`) then deep; 2–3 deep 2px chips fall 14–22px / 300ms Quad.easeIn; stage-3 grounded tremble `sin(now*0.045)*0.6px` on `_bobY` | NORMAL | 3 | never |
| Flag carrier aura | `syncFlag` carrier attach (`GameScene.js:600-632`) | fx-glow follow sprite, amber tint, α pulse 0.12–0.2, depth 9 (behind body) | ADD | 1 | MEDIUM, LOW (HUD chip + pinned flag carry the info) |
| Carrier drip trail | while carried | dust follow-emitter, 2px amber, freq 45ms, life 350ms | NORMAL | ~8 alive | LOW |
| Flag base beacon | `Level` build, next to base markers (`Level.js:68-83`) | flat amber rect α0.07 rising 120px — the sanctioned "-soft" flat fill, **no gradient** | NORMAL | 1 rect | never (free) |
| Capture celebration | `onLog` CAPTURE branch (`GameScene.js:273-274`) | `fx.ring` amber at base + `fx.burst` explode(16) + low-intensity team `cameras.main.flash(180, r,g,b)` | — | 16 | never |
| Base light wells | `Level` build | flat team-color rect `(96×180, color, 0.06)` above each base, depth 1 | NORMAL | 2 rects | never (free) |
| Ambient weather/motes | per theme, Backdrop | one pooled emitter, theme config, depth −5 | NORMAL | 30 / 12 / 0 | LOW |
| Backdrop accents | per theme | whole-object tweens (blink/drift/sweep), stepped/sine eases | NORMAL | ≤3 tweens | MEDIUM, LOW |
| Vignette | `GameScene.create`, low-HP intensify | `cameras.main.postFX.addVignette(0.5, 0.5, 0.88, 0.14)` behind `canAddPostFX` guard; strength ≤ 0.15, animate only on low-HP | — | 1 pass | MEDIUM, LOW, Canvas |
| Low-HP danger frame | local hp ≤ 30 | DOM `#damage-frame`, `box-shadow: inset 0 0 0 3px var(--p2)`, bf-pulse 1.2s; flash to 0.9 / 160ms on hit; directional edge tick (3px bone bar, left/right by `knockX` sign) | DOM | 3 divs | never (flat, free) |
| Win confetti | `showMatchEnd` | 14 one-shot 6×6 tweened rects in winner color at base, 1.4s, depth 18 | NORMAL | 14 / 8 mobile | never (rare) |

---

## 5. Game Feel Spec

**The audio-visual sync contract:** flash + particles + SFX execute in the same handler invocation, never via scattered `delayedCall`s. `player-moan` stays at +40ms (lands as hitstop releases). Full-charge crossing 1.0 plays `arrow-shoot {rate:2.2, volume:0.06}` as a click synced to the nock dot starting to blink. Kill layers `body-hit {rate:0.8}` + confirm ring same frame; shatter = `arrow-hit {rate:0.6, volume:0.3}`. All layering via WebAudio rate on the existing 17 .wav files — zero new assets; keep the `cache.audio.exists` guards.

| Event | Duration | Values / Easing |
|---|---|---|
| Hit white-flash | `HIT.FLASH_MS` | body repaint white (`Player.js:275`) — never longer |
| Hit squash (directional) | 90ms yoyo | horizontal hit: scaleX 0.78 / scaleY 1.16; vertical: 1.22 / 0.8 — axis from dominant `knockX/Y` component, passed into `flashHit(knockX, knockY)`; Cubic.easeOut |
| Hit lean impulse | ~180ms settle | `_hitLean = clamp(knockX/600)*0.16` rad, decay ×0.82/frame, summed into existing `_leanAngle` consumers (`Player.js:218/230/266`) |
| Hitstop — local hit | 50ms | fxTimeScale 0.3; arrows on real dt; single non-stacking deadline |
| Hitstop — kill confirm | 90ms | fxTimeScale 0.15 |
| Input lock | 150ms | existing `HIT.INPUT_LOCK_MS` — unchanged |
| Trauma decay | 1.4/s linear | offset = noise × trauma² × 6px world (≈11px screen at zoom 1.8 — hard cap); sources in §2.5 |
| Kick decay | half-life 90ms | hit 8px, recoil 3px |
| Kill zoom punch | 60ms in / 180ms out | ×1.045, Sine.easeOut |
| Charge zoom | 250ms in / 160ms out | ×1.03 while charging; exhale on release, Sine.easeOut |
| Aim lookahead | continuous | `(cos(rot)*(24+28*pull), sin(rot)*14)`, lerp 0.08, clamp 52px |
| Shot recoil | 60ms yoyo | scaleX 0.92 / scaleY 1.06, Quad.easeOut, after `_resetScaleTweens()` |
| Bow rotation recoil | 120ms | −0.1×pull → 0, Expo.easeOut |
| Jump crouch → takeoff stretch | crouch (existing) → **70ms** stretch → 130ms settle | insert `{scaleX:0.88, scaleY:1.2, duration:70, ease:'Quad.easeOut'}` mid-chain (`Player.js:326-332`), settle Quad.easeIn |
| Landing squash | 70ms yoyo | intensity = clamp(impactVy/600); existing curve (`Player.js:335-348`) |
| Hard landing | 50ms leg flash, 160ms shockwave | threshold impactVy > 520; same frame as SFX |
| Death | 60ms white hold → 360ms topple | existing Cubic.easeOut topple + shards ≤ 420ms (up 140ms Quad.easeOut, down 260ms Quad.easeIn) |
| Spawn flash | 220ms | team color RGB, ~35% intensity |
| Shockwave/confirm ring | 260–280ms | scale 0.3→1.4, Cubic.easeOut, 2px stroke |
| Muzzle flash | 70ms | glow scale 0.4→1.1, α 0.7→0 |
| Full-charge blink | 125ms steps(2) | `Math.floor(performance.now()/125)%2` |
| UI entrances | 240ms | toastIn, `cubic-bezier(.2,.8,.2,1)` |
| UI exits | 120ms | reverse, faster than open |
| Screen wipe | 350ms + 350ms | `cubic-bezier(.7,0,.3,1)`, flat bone |
| Overlay fadeIn | 320ms | +6px rise |
| Score pop | 320ms | scale 1→1.3→1 |
| Ambient loops | 1–2s | bf-bob 1.6s, bf-pulse 2s, bf-blink 1s steps(2) |

**Banned:** elastic/bounce/back easings anywhere; camera rotation; timeScale dips > 90ms or applied to arrow dt (the 60px reconciliation snap at `Arrow.js:79` would visibly teleport); stacking scale tweens without `_resetScaleTweens()` first.

**Multiplayer parity rule:** every effect keys off the HIT broadcast (carries `shooterId`, `knockX/Y`, `hp`, `alive`) and `arrows.onAdd` — never local physics — so local and remote actors read identically. **Remote charge telegraphy** (the highest-value readability change): add `charging:boolean` + quantized `pull` (`Math.round(pull*15)`) to `Player.getState()` (`Player.js:467-479`) and the server schema in `server/src/rooms/GameRoom.js`; relay at the existing 60Hz patch rate (~2 bytes delta-encoded); RemotePlayer lerps `bow.pull` toward received at 0.25/frame. The whole charge package then renders on remotes for free because `Bow._draw` is shared. Dodging becomes a read, not a coin flip.

---

## 6. UI/HUD & Presentation

All DOM, all tokens via CSS custom properties, all animation opacity/transform-only, `pointer-events:none` on every new layer so touch joysticks are unaffected.

### HUD
- **Vitals card** replacing the bare spans in `#hud` (`client/index.html:179-184`): `--bf-arena` bg, 3px team-color border-left, mono 11px name, 6px HP track with team fill (`width 200ms ease`) + bone 40%-alpha ghost fill (450ms, 250ms delay — fighting-game damage chunk), 4px charge meter visible only while drawing, blinking bf-blink at full pull. New `syncHudVitals()` next to `syncScores()` in `GameScene.update()`, change-cached (hp integer, charge quantized 0.02) writing `el.style.setProperty('--hp', pct)`.
- **`#flag-status` chip**: mono 11px uppercase 0.18em "FLAG CARRIED", 2px border-left in carrier team color, bf-blink steps(2); toggled in `syncFlag` on carrier change only.
- **Score pop**: in `syncScores` (`GameScene.js:956-965`), retrigger `.score-pop` (remove → `void el.offsetWidth` → add), scale 1→1.3→1 / 320ms.
- **Damage frame + directional ticks**: §4 table — flat inset stroke, never a gradient fog.
- **Kill feed rework** (`client/src/event-log.js`): incremental DOM instead of full `innerHTML` rebuild (lines 87-92) — `appendChild` per entry (keeps the 180ms event-log-in slide), `.is-leaving` reverse-slide on purge with `animationend` removal; 2px team border-left per entry; cap 4 entries on `is-mobile`. Strictly cheaper than today.

### Overlay motion — `client/src/ui/overlay-motion.js` (new)
`openOverlay(el)` / `closeOverlay(el)`: open removes `.hidden` + adds `.is-open` (panel toastIn 240ms, backdrop fade 160ms); close adds `.is-leaving`, waits for `animationend` (200ms setTimeout fallback) before re-hiding. Wire into `game-menu.js`, `menu.js`, `skin-picker.js`, `map-picker.js`, `solo-picker.js`, `settings.js`, `create-room.js`, and GameScene's team picker/scoreboard/match-end. `leaveGame()`'s force-hide list (`main.js:143-144`) keeps raw `.hidden` as the safety path. Plus a blanket `@media (prefers-reduced-motion: reduce)` rule in `style.css` setting all animation/transition durations to 1ms — currently absent entirely.

### Match start (non-blocking — the server never gates round start; input is never locked)
- t=0: Play → `doStartGame()` (`main.js:106`) appends full-screen `#wipe` div (flat `--bf-bone`, `pointer-events:none`), translateX −100%→0 / 350ms `cubic-bezier(.7,0,.3,1)`
- t=350ms: under cover, toggle `#menu`/`#game`, construct Phaser.Game (kills today's canvas pop-in)
- t=700ms: wipe exits 0→100% / 350ms, element removed
- In-canvas (`spawnLocalPlayer`, `GameScene.js:763-788`): `cam.centerOn(spawn)` at `GAME.ZOOM*0.78` → `cam.zoomTo(GAME.ZOOM, 900, 'Cubic.easeInOut')` + `cam.pan(spawn, 900)`; on `Phaser.Cameras.Scene2D.Events.PAN_COMPLETE` → `cam.startFollow(sprite, true, GAME.CAMERA_LERP, GAME.CAMERA_LERP)`
- t=900ms: `#match-intro` chip (eyebrow "ARENA" + `t('map.'+mapId)`, Space Grotesk 32px), toastIn 240ms, hold 1200ms, fade 320ms
- Respawn path (`exitDeath`, `GameScene.js:1035-1067`) keeps the instant camera reset.

### Death/respawn
`enterDeath` (`GameScene.js:1026-1033`): `cam.zoomTo(GAME.ZOOM*1.1, 260, 'Cubic.easeOut')` → back over 600ms before the overlay. `#death-overlay`: fadeIn 320ms +6px rise, "YOU DIED" Space Grotesk 64px −0.05em on flat `--bf-void` scrim (**no backdrop-filter**). `#death-timer` per-second `.tick` retrigger (scale 1.3→1 / 200ms, tabular-nums). Exit: `.death-overlay--out` 120ms fade before `.hidden`.

### Match end (`showMatchEnd`, `GameScene.js:1080`)
- t=0: hide `#hud` + kill feed; `cam.stopFollow()` + `cam.pan(winnerBase, 700, 'Cubic.easeInOut')` + `cam.zoomTo(GAME.ZOOM*1.15, 700)` framing `this.level.map.bases.team1/team2`; 14 winner-color confetti rects at the base
- t=900ms: `#match-end` panel toastIn; title styled per design results screen — Space Grotesk 64px, −0.05em, line-height 0.85, "JADE WINS."
- t=1140ms+: scoreboard rows (built at `GameScene.js:1104`) get `style="--i:${index}"` and CSS `animation: row-in 320ms cubic-bezier(.2,.8,.2,1) backwards; animation-delay: calc(var(--i) * 120ms)` (translateX 20px→0 + fade)
- t≈1800ms: rematch/map buttons fade in last
- Strictly non-blocking; enemies stay visible.

### Hygiene
Remove the dev "Quick test (jade)" button from `client/index.html`; delete stale `map.open/map.stacks/map.ravine` i18n keys (`client/src/i18n.js:85-89`); fix the stale dimension comment at `shared/maps.js:20`; interim `#game` opacity 0→1 / 200ms until the wipe ships.

---

## 7. Performance Contract

**Renderer config** (`main.js:111-127`): add `render: { powerPreference: 'high-performance', antialias: false, roundPixels: true }` (makes the pixelArt implications explicit and requests the discrete GPU). **Do NOT** cap fps (60Hz netcode interp reads best at native rate) and **do NOT** add devicePixelRatio upscaling — the fixed 1280×720 Scale.FIT backing store is the project's mobile fill-rate cap and stays. Log `console.info('[perf] renderer=%s tier=%s', ...)` once per game start.

**Frame budget (16.7ms target, mid-range laptop / 2020-era Android):**

| System | Budget |
|---|---|
| Colyseus patch decode + handlers | 1.2ms |
| GameScene.update sync loops + sendState | 1.0ms |
| Arcade physics step | 0.8ms |
| postupdate Graphics redraws | **2.0ms hard cap** (redraw scheduler enforces) |
| Particles + TweenManager | 0.8ms |
| WebGL flush/draw | 4.0ms |
| postFX | 1.5ms (HIGH only, else 0) |
| DOM HUD/kill-feed mutations | 0.7ms |
| GC + headroom | ≥ 4.7ms — if gone, governor demotes |

**Particle caps (`maxAliveParticles`, HIGH / MEDIUM / LOW):** hit 48/24/12 · dust 32/16/8 · splash 24/12/6 · sparks 24/12/0 · debris 24/12/0 · ambient 30/12/0 · **global ceiling 160/80/32**. Overflow clips the burst — correct degradation. Per-burst counts also × tier multiplier (1 / 0.5 / readability-floor minimums on LOW).

**Tier definitions:**
- **HIGH** (desktop WebGL): everything — vignette postFX, KillShockFX, fx-glow effects, ≤ 4 simultaneous per-object Glow FX (`quality ≤ 0.1, distance ≤ 8` — each breaks batching and costs a framebuffer pass), 2 sparse parallax layers + accents, full budgets.
- **MEDIUM** (mobile WebGL): **no postFX, no Glow, no fx-glow sprites**; budgets halved; farthest backdrop band + all ambient tweens skipped; SpawnShield/Bee/Flag redraw at 30Hz; trauma offset halved.
- **LOW** (Canvas fallback / reduced-motion / governor floor): gameplay-essential FX only — hit flash, spawn pulse, simplified spawn shield (static stroke), 4-point arrow trail, death topple + X-face; no dust/splash/weather/dressing bake; ambient loops at 20Hz.

**PostFX policy** (codified in `quality.js` as `canAddPostFX`): CHEAP single-pass (Vignette, ColorMatrix, Wipe, Shine, Barrel) allowed on HIGH; MEDIUM-cost (Glow, Shadow, Displacement, Pixelate) per-object only, capped at 4; **Bloom and Blur are banned on cameras at every tier** — multi-pass full-framebuffer blur both costs 2–5ms on mobile GPUs and softens every 1–2px line, destroying the identity. All postFX guarded by `renderer.type === Phaser.WEBGL`.

**Overdraw rules:** camera clear is free; +1 full-coverage opaque layer (gradient sky / baked RT) safe on all tiers; additional layers must be sparse (< 25% screen coverage of translucent pixels) — max 3 sparse layers HIGH, 2 MEDIUM, 0 LOW; never a second full-screen translucent canvas layer on mobile; never stack new DOM `backdrop-filter` surfaces over the canvas during gameplay (the existing blur(4px) overlays are already a compositing cost — new screen layers are flat fills).

**Testing protocol (acceptance gate for every FX PR):** profile production builds only (`npm run build && vite preview`); standard worst case = 8-player ctf on `tunnels` (88 solids) + a bee-mode run, 60s combat, 10s Tab held, `?perf=1`; Performance panel 20s @ 4× CPU throttle → assert rAF p95 ≤ 12ms; heap snapshots before/after 2min combat → near-zero growth in `Phaser.GameObjects.Rectangle` and Tween counts (the pooling win, verifiable); real-device pass via `chrome://inspect` on a Pixel-a-class Android and Safari Web Inspector on an older iPhone → MEDIUM holds ≥ 55fps. Gates: desktop HIGH ≥ 58fps sustained; 4×-throttle MEDIUM ≥ 50fps; 6×-throttle LOW ≥ 30fps, no GC spike > 8ms. The chrome-devtools MCP tracing tools (`performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`) can automate this against `vite preview` pre-merge.

---

## 8. Phased Roadmap

### Phase 1 — Foundation + quick wins (~1 week)

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Fix particle layering: `.setDepth(18)` on burst rects | `GameScene.js:667, 688, 711` | 15 min |
| 2 | Team-color spawn flash (decompose color int, replace `flash(220,80,80,80)`) | `GameScene.js:794` | 15 min |
| 3 | Kill-confirm v0: `alive===false && shooterId===sessionId` → shake(90, 0.004)... escalating to shake(220, 0.009) + zoomTo punch + victim-colored spawnPulse ring | `GameScene.js:634` | 1 hr |
| 4 | `render` block + `[perf]` log line | `main.js:111` | 15 min |
| 5 | Arrow trail `setBlendMode(Phaser.BlendModes.ADD)`; bee death burst + alpha tween | `Arrow.js`, `GameScene.js:1002` | 30 min |
| 6 | `fx/quality.js` + registry plumbing + settings row + `'boxfury:quality'` localStorage | new, `main.js`, `settings.js` | 0.5 day |
| 7 | `fx/textures.js` (`ensureFxTextures`, all 5 keys, exists-guards) | new, `GameScene.create` | 2 hr |
| 8 | `fx/FxManager.js`: pooled emitters, migrate the 3 burst functions (signatures intact), `maxAliveParticles` caps, ring pool | new, `GameScene.js:659-725, 791-804` | 1 day |
| 9 | `fx/perf.js`: governor + `?perf=1` HUD + postupdate ms bracket | new, `GameScene.js` | 0.5 day |
| 10 | `fx/CameraFx.js`: trauma + kick, replace hardcoded shake, reset hooks in enterDeath/exitDeath/spectator | new, `GameScene.js:655, 1026, 1035` | 0.5 day |
| 11 | Shot recoil + bow tension + full-charge blink dot + takeoff stretch + directional hit squash + hit lean | `Player.js:283-290, 326-332, 397`, `Bow.js:61-71`, `RemotePlayer.js` mirror, `handleHit` | 1 day |
| 12 | CSS pass: `prefers-reduced-motion` blanket rule, score pop, death-overlay entrance + timer tick, `#game` fade-in, remove Quick test button | `style.css`, `index.html`, `GameScene.js:956-965, 1069` | 0.5 day |
| 13 | Hygiene: stale i18n map keys, `maps.js:20` comment; Tab-scoreboard signature gate | `i18n.js:85-89`, `maps.js`, `GameScene.js` | 30 min |

### Phase 2 — Atmosphere (~2 weeks)

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | `shared/themes.js` (canonical hex table, 4 theme scripts, `getTheme`, `toCssHex`) + export from `shared/index.js` | new | 1 day |
| 2 | Theme plumbing in Level: `lineColor`, `setBackgroundColor`, `solidEdge`, beacon, light wells | `Level.js:35-83` | 0.5 day |
| 3 | `entities/Backdrop.js`: gradient sky quad (WebGL-guarded), silhouette bands (seeded, drawn once, neg depths), lifecycle in `rebuild()` + `_teardownEntities` | new, `Level.js:19-33`, `GameScene.js:297-311` | 2 days |
| 4 | Ambient weather emitter per theme (snow on SUMMIT first), camera-following emit zone | `Backdrop.js`, `FxManager` | 0.5 day |
| 5 | Arena dressing baked to RenderTexture: ruler ticks, corner brackets, themed solid edges | `Level.js` | 1 day |
| 6 | Theme-aware map picker previews (gradient + silhouette swatches) | `map-picker.js:80-122` | 0.5 day |
| 7 | HUD vitals card + `#flag-status` chip + damage frame + directional ticks + `syncHudVitals` | `index.html:179-184`, `style.css`, `GameScene.js` | 1.5 days |
| 8 | `ui/overlay-motion.js` + wiring into all 8 overlay owners | new, pickers/menus, `GameScene.js` | 1 day |
| 9 | Match-start sequence (wipe + camera intro + map toast) | `main.js:106`, `GameScene.js:763-788`, `style.css` | 1 day |
| 10 | Match-end sequence (camera framing + confetti + staggered rows) | `GameScene.js:1080-1104` | 1 day |
| 11 | Kill feed incremental rework | `event-log.js` | 0.5 day |
| 12 | Arrow tracer package: follow-emitter trail, muzzle flash, tip glow (HIGH) | `Arrow.js:119-136`, `GameScene.js:250-258` | 1 day |
| 13 | Full hit-impact stack: sparks, impact flash, pooled shockwave rings | `handleHit`, `FxManager` | 0.5 day |
| 14 | Redraw scheduler: leg/bow dirty flags, ambient Hz caps, poll gating | `Player.js`, `RemotePlayer.js`, `Bow.js`, `SpawnShield.js`, `Flag.js`, `Bee.js`, `GameScene.js` | 1.5 days |

### Phase 3 — Themes & polish

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Remote charge telegraphy: `charging`/`pull` schema fields + RemotePlayer lerp | `Player.js:467-479`, `server/src/rooms/GameRoom.js`, `GameScene.js:213-231` | 1 day |
| 2 | Death shatter + 60ms white hold + `drawDeadFace` + kill-direction cache | `Player.js:153-172`, `RemotePlayer.js:103-123`, `faces.js`, `syncDeath` | 1 day |
| 3 | Crack-stage punctuation + stage-3 tremble | `Player.js:191, update`, `cracks.js` | 0.5 day |
| 4 | Hard-landing impact frames + floor shockwave + remote parity threshold | `Player.js:335-360`, `RemotePlayer.js:320-338` | 0.5 day |
| 5 | Hitstop (50/90ms, arrows on real dt, single deadline) | `GameScene.js` update loop, `handleHit` | 1 day |
| 6 | Flag carrier aura + drip trail + capture celebration ring/flash | `syncFlag`, `onLog`, `FxManager` | 0.5 day |
| 7 | Camera feel pack: aim lookahead + charge zoom (into CameraFx) | `CameraFx.js`, `GameScene.js:1371-1378` | 0.5 day |
| 8 | Vignette (HIGH) + low-HP intensify | `GameScene.create` | 2 hr |
| 9 | `fx/KillShockFX.js` PostFXPipeline, re-registered per match, HIGH only | new, `GameScene.create`, `handleHit` | 2 days |
| 10 | Animated backdrop accents (blink/drift/beacon/shimmer) | `Backdrop.js` | 1 day |
| 11 | FOUNDRY + CANOPY theme data for future maps; ambient motes on ARENA PRIME | `shared/themes.js` | 0.5 day |
| 12 | Full perf protocol pass + budget assertions on all three tiers | — | 1 day |

---

## 9. Identity Guardrails

**Do**
- Express every state geometrically first: rings, brackets, ticks, blink dots — light is the escalation, not the default
- Keep all glow effects **event-scoped** (≤ 300ms lifetimes); the only persistent glows (carrier aura) capped at alpha ≤ 0.2, and only on HIGH
- Take every tint from the 6 `COLORS` tokens (`shared/constants.js:115-123`) — never intermediate hues; reference CSS custom properties in all new CSS
- Keep backdrop fills ≤ `#2a2a3a` luminance; ambient particles ≤ 3px at alpha ≤ 0.35; accents as 1–2px dots at alpha ≤ 0.5 — codify these as lint-style comments in `shared/themes.js`
- Build every silhouette from rects + triangles + `fillRoundedRect` r2; clouds are bars, the sun is a square, dunes are trapezoids — a theme that needs a circle gets redesigned
- Use ≥ 2px strokes for all backdrop linework (pixelArt:true + zoom 1.8 shimmer)
- Create ALL textures/emitters/pipelines in `GameScene.create()` with `textures.exists` guards; tear down tweens/emitters in `Backdrop.destroy()`, `Level.rebuild()`, and `_teardownEntities` — the Phaser.Game dies every match
- Key every combat effect off the HIT broadcast and `arrows.onAdd` so local and remote players read identically — asymmetry reads as bugs, not juice
- Set `particleTint` immediately before every `explode()`
- Call `_resetScaleTweens()` before any new scale tween on the player anchor; never touch `body.setSize`
- Keep shatter shards ≤ 10px, ≤ 600ms, always fading, biased along kill direction — consequence, not objects

**Don't**
- Never call `cameras.main.postFX.addBloom` or camera Blur — they soften every 1–2px line on screen; the postFX budget is exactly two (static vignette + 160ms KillShockFX)
- Never flip `pixelArt:false` or set global LINEAR filtering — only `fx-glow` gets `setFilter(LINEAR)`, per-texture-key
- Never use gradients, drop-shadows, or glow in base art / world dressing / UI — the design reference's only sanctioned soft effect is the damaged-state inset stroke; ambient "lighting" is flat fills at 6–15% alpha (the `-soft` token pattern)
- Never let quality tiers remove gameplay information: hit flash, shield presence, carrier indication, spawn pulse, death animation stay on at every tier — only ornamentation is demotable
- Never implement hitstop via dips > 90ms, stacked deadlines, or scaled arrow dt — the 60ms interpolation buffer and 60px arrow snap will rubber-band visibly
- Never exceed the trauma cap (6px world offset ≈ 11px screen at zoom 1.8), never rotate the camera, never trigger camera effects from remote-only events — aiming is the core verb
- Never add another per-frame Graphics clear+redraw loop — event tweens or the pooled emitter only; the postupdate path has a 2.0ms hard cap
- Never put pure-white flashes on screen for > 90ms — white is a damage word in a bone-on-deep game
- Never place saturated jade/crimson in the environment within ~2 tiles of base markers, or brighter than alpha 0.25 — they are IFF signals
- Never animate anything faster than ~1px/frame in the gameplay focal plane (scrollFactor ≥ 0.7); weather drifts slowly, never fast-horizontal
- Never hardcode hexes in JS (the map-picker mistake) — read from `shared/themes.js` / CSS custom properties; the canonical table in themes.js settles the `#15151f` vs `#1a1a26` drift permanently
- Never block input or hide enemies for presentation — the server doesn't pause; intros/outros are overlays and camera moves only
- Never add new full-screen translucent layers or DOM `backdrop-filter` surfaces over the canvas on mobile; new screen layers are flat, `pointer-events:none`, opacity/transform-animated only