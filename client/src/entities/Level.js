import { COLORS, DEFAULT_MAP_ID, TILE, getMap, getTheme, parseMap } from '@boxfury/shared';
import { Backdrop } from './Backdrop.js';
import { Flag } from './Flag.js';

export class Level {
  constructor(scene, mapId = DEFAULT_MAP_ID) {
    this.scene = scene;
    this.platforms = scene.physics.add.staticGroup();
    this.solids = scene.physics.add.staticGroup();
    this.markers = [];
    this.flag = null;
    this.backdrop = null;
    this.mapId = mapId;
    this.map = parseMap(getMap(mapId));
    this.theme = getTheme(mapId);

    this.applyBounds();
    this.buildBackdrop();
    this.buildWalls();
    this.buildMarkers();
  }

  rebuild(mapId) {
    this.mapId = mapId;
    this.platforms.clear(true, true);
    this.solids.clear(true, true);
    for (const m of this.markers) m.destroy?.();
    this.markers = [];
    if (this.flag) {
      this.flag.destroy?.();
      this.flag = null;
    }
    this.backdrop?.destroy();
    this.backdrop = null;
    this.map = parseMap(getMap(mapId));
    this.theme = getTheme(mapId);
    this.applyBounds();
    this.buildBackdrop();
    this.buildWalls();
    this.buildMarkers();
  }

  applyBounds() {
    const w = this.map.pixelWidth;
    const h = this.map.pixelHeight;
    this.scene.physics.world.setBounds(0, 0, w, h);
    this.scene.cameras.main.setBounds(0, 0, w, h);
    // The global config backgroundColor can't vary per map; the camera can.
    this.scene.cameras.main.setBackgroundColor(this.theme.sky.top);
  }

  buildBackdrop() {
    this.backdrop = new Backdrop(
      this.scene,
      this.map,
      this.theme,
      this.scene.quality ?? 'high',
    );
  }

  /** Rebuild only the backdrop at the scene's current quality tier —
   *  called by the frame governor on live demotion. */
  rebuildBackdrop() {
    this.backdrop?.destroy();
    this.backdrop = null;
    this.buildBackdrop();
  }

  buildWalls() {
    const lineColor = this.theme.lineColor ?? COLORS.BONE;
    const solidColor = this.theme.solidColor ?? COLORS.BONE;
    for (const wall of this.map.walls) {
      const top = wall.y - wall.h / 2;
      const line = this.scene.add.rectangle(
        wall.x,
        top + TILE.WALL_THICKNESS / 2,
        wall.w,
        TILE.WALL_THICKNESS,
        lineColor,
      );
      this.platforms.add(line);
    }
    if (this.map.solidWalls) {
      const edge = this.theme.solidEdge;
      for (const w of this.map.solidWalls) {
        const block = this.scene.add.rectangle(w.x, w.y, w.w, w.h, solidColor);
        this.solids.add(block);
        if (edge) {
          // Themed top edge (e.g. Summit snow caps). Pure dressing — no body.
          const cap = this.scene.add.rectangle(
            w.x,
            w.y - w.h / 2 + 1,
            w.w,
            2,
            edge.color,
            edge.alpha,
          );
          cap.setDepth(1);
          this.markers.push(cap);
        }
      }
    }
  }

  buildMarkers() {
    if (this.map.bases.team1) this.drawBase(this.map.bases.team1, COLORS.P1_JADE, 'J');
    if (this.map.bases.team2) this.drawBase(this.map.bases.team2, COLORS.P2_CRIMSON, 'C');
    if (this.map.flag) {
      this.flag = new Flag(this.scene, this.map.flag);
      // Flag beacon: flat AMBER fill rising above the flag stand — always
      // amber (the flag's own neutral color), never theme.accent: a crimson
      // accent column over the neutral objective would read as team-2.
      const beacon = this.scene.add.rectangle(
        this.map.flag.x,
        this.map.flag.y - TILE.HEIGHT / 2 - 60,
        24,
        120,
        COLORS.P4_AMBER,
        0.07,
      );
      beacon.setDepth(1);
      this.markers.push(beacon);
    }
  }

  drawBase(pos, color, label) {
    const w = TILE.WIDTH + 8;
    const h = TILE.HEIGHT + 8;
    const g = this.scene.add.graphics();
    g.lineStyle(1.5, color, 1);
    drawDashedRect(g, pos.x - w / 2, pos.y - h / 2, w, h, 4, 4);

    const text = this.scene.add.text(pos.x, pos.y, label, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: hexColor(color),
    }).setOrigin(0.5);

    // Base light well: flat team-color fill rising above the base. Kept at
    // alpha 0.06 — team colors in the environment must stay whispers.
    const well = this.scene.add.rectangle(
      pos.x,
      pos.y - h / 2 - 90,
      96,
      180,
      color,
      0.06,
    );
    well.setDepth(1);

    this.markers.push(g, text, well);
  }

}

function hexColor(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

function drawDashedRect(g, x, y, w, h, dash, gap) {
  drawDashedLine(g, x, y, x + w, y, dash, gap);
  drawDashedLine(g, x + w, y, x + w, y + h, dash, gap);
  drawDashedLine(g, x + w, y + h, x, y + h, dash, gap);
  drawDashedLine(g, x, y + h, x, y, dash, gap);
}

function drawDashedLine(g, x1, y1, x2, y2, dash, gap) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  const stride = dash + gap;
  for (let d = 0; d < len; d += stride) {
    const end = Math.min(d + dash, len);
    g.beginPath();
    g.moveTo(x1 + ux * d, y1 + uy * d);
    g.lineTo(x1 + ux * end, y1 + uy * end);
    g.strokePath();
  }
}
