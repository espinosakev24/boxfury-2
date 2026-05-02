import { COLORS, DEFAULT_MAP, TILE, parseMap } from '@boxfury/shared';
import { Flag } from './Flag.js';

export class Level {
  constructor(scene, mapString = DEFAULT_MAP) {
    this.scene = scene;
    this.platforms = scene.physics.add.staticGroup();
    this.markers = [];
    this.flag = null;
    this.map = parseMap(mapString);

    this.buildWalls();
    this.buildMarkers();
  }

  buildWalls() {
    for (const wall of this.map.walls) {
      const top = wall.y - wall.h / 2;
      const line = this.scene.add.rectangle(
        wall.x,
        top + TILE.WALL_THICKNESS / 2,
        wall.w,
        TILE.WALL_THICKNESS,
        COLORS.BONE,
      );
      this.platforms.add(line);
    }
  }

  buildMarkers() {
    if (this.map.bases.team1) this.drawBase(this.map.bases.team1, COLORS.P1_JADE, 'J');
    if (this.map.bases.team2) this.drawBase(this.map.bases.team2, COLORS.P2_CRIMSON, 'C');
    if (this.map.flag) this.flag = new Flag(this.scene, this.map.flag);
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

    this.markers.push(g, text);
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
