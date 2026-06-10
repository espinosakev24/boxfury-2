// Per-map visual themes. Pure data + lookups — no Phaser, no DOM — so the
// client, map picker, and map editor all read from one source of truth.
// The server never consumes themes; mapId alone crosses the wire.
//
// Identity guardrails (see docs/VISUAL_REDESIGN.md §9):
// - Backdrop fills stay at or below LINE (#2a2a3a) luminance.
// - Ambient particles ≤ 3px at alpha ≤ 0.35; accents 1-2px at alpha ≤ 0.5.
// - Saturated player colors appear in the environment only as darkened
//   derivatives or at alpha ≤ 0.25 — they are IFF signals first.
// - Every silhouette is rects + triangles + r2 rounded rects. No circles.

// Canonical hex table — settles the #15151f vs #1a1a26 drift permanently.
// VOID is the canvas/scrim background (CLAUDE.md's "deep"), DEEP is the
// panel surface, ARENA the in-game backdrop base.
export const PALETTE = {
  VOID: 0x15151f,
  DEEP: 0x1a1a26,
  ARENA: 0x1f1f2c,
  BONE: 0xf5f5f0,
  LINE: 0x2a2a3a,
  MUTE: 0x4a4a5e,
  JADE: 0x4ee08a,
  CRIMSON: 0xff5470,
  AZURE: 0x4eb1ff,
  AMBER: 0xffd84e,
};

export const THEMES = {
  // The canonical sci-fi arena look — blueprint grid, stadium skyline.
  arenaPrime: {
    name: 'Arena Prime',
    sky: { top: 0x15151f, bottom: 0x1f1f2c },
    lineColor: PALETTE.BONE,
    solidColor: PALETTE.BONE,
    solidEdge: null,
    accent: PALETTE.AMBER,
    layers: [
      { kind: 'grid', color: PALETTE.LINE, alpha: 0.4, scrollFactor: 0.15, seed: 11 },
      {
        kind: 'skyline',
        color: PALETTE.DEEP,
        alpha: 1,
        scrollFactor: 0.35,
        seed: 12,
        blink: { color: PALETTE.AMBER, alpha: 0.25, ms: 800 },
      },
    ],
    ambient: {
      kind: 'motes',
      color: 0x8a8a9e,
      count: 30,
      speedY: [-6, 6],
      speedX: [-8, 8],
      alpha: 0.12,
      lifespan: 8000,
    },
    dressing: { ticks: true, cornerMarks: true },
  },

  // Frozen — twinRaise's pyramid IS a mountain. Ridges, cloud bars, snow.
  summit: {
    name: 'Summit',
    sky: { top: 0x15151f, bottom: 0x232840 },
    lineColor: PALETTE.BONE,
    solidColor: PALETTE.BONE,
    solidEdge: { color: 0xffffff, alpha: 0.5 }, // snow caps on solid blocks
    accent: PALETTE.AZURE,
    layers: [
      { kind: 'ridge', color: 0x1b1e30, alpha: 1, scrollFactor: 0.1, seed: 21 },
      // Darker than sky.bottom so the silhouette reads against the gradient.
      { kind: 'ridge', color: 0x1e2238, alpha: 1, scrollFactor: 0.25, seed: 22 },
      {
        kind: 'clouds',
        color: PALETTE.BONE,
        alpha: 0.08,
        scrollFactor: 0.4,
        seed: 23,
        drift: { px: 40, ms: 12000 },
      },
    ],
    ambient: {
      kind: 'snow',
      color: PALETTE.BONE,
      count: 30,
      speedY: [8, 18],
      speedX: [-8, 8],
      alpha: 0.35,
      lifespan: 9000,
    },
    dressing: {},
  },

  // Volcanic — tunnels as a deep cavern. Stalactites, heat band, embers.
  mantle: {
    name: 'Mantle',
    sky: { top: 0x15151f, bottom: 0x2b1620 },
    lineColor: PALETTE.BONE,
    solidColor: PALETTE.BONE,
    solidEdge: null,
    accent: PALETTE.CRIMSON,
    layers: [
      { kind: 'stalactites', color: 0x1c1420, alpha: 1, scrollFactor: 0.2, seed: 31 },
    ],
    ambient: {
      kind: 'embers',
      // Darkened crimson/amber derivatives, NOT the raw IFF hexes — at
      // ambient alpha, saturated team colors would read as enemy presence.
      color: [0xb23b4e, 0xb29737],
      count: 24,
      speedY: [-30, -12],
      speedX: [-6, 6],
      alpha: 0.35,
      lifespan: 4200,
      shrink: true,
    },
    // 0.1 base; the shimmer tween pulses object alpha 0.6-1 => 0.06<->0.1.
    dressing: { glowBand: { color: PALETTE.CRIMSON, alpha: 0.1 } },
  },

  // Floating sky islands — block silhouettes with triangle undersides.
  strata: {
    name: 'Strata',
    sky: { top: 0x15182a, bottom: 0x232a44 },
    lineColor: PALETTE.BONE,
    solidColor: PALETTE.BONE,
    solidEdge: null,
    accent: PALETTE.AZURE,
    layers: [
      { kind: 'islands', color: 0x1b2138, alpha: 1, scrollFactor: 0.12, seed: 41 },
      // Darker than sky.bottom so the silhouette reads against the gradient.
      { kind: 'islands', color: 0x1e2438, alpha: 1, scrollFactor: 0.3, seed: 42 },
      {
        kind: 'clouds',
        color: PALETTE.BONE,
        alpha: 0.06,
        scrollFactor: 0.45,
        seed: 43,
        drift: { px: 40, ms: 14000 },
      },
    ],
    ambient: {
      kind: 'motes',
      color: PALETTE.AZURE,
      count: 24,
      speedY: [-14, -6],
      speedX: [-6, 6],
      alpha: 0.2,
      lifespan: 7000,
    },
    dressing: {},
  },
};

export const MAP_THEMES = {
  default: 'arenaPrime',
  twinRaise: 'summit',
  tunnels: 'mantle',
  islands: 'strata',
};

export function getTheme(mapId) {
  return THEMES[MAP_THEMES[mapId]] ?? THEMES.arenaPrime;
}

export function toCssHex(int) {
  return '#' + int.toString(16).padStart(6, '0');
}
