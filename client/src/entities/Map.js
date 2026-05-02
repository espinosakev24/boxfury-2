import { COLORS, MAPS, parseMap } from '@boxfury/shared';

export class GameMap {
  constructor(scene, mapId) {
    this.scene = scene;
    this.def = MAPS[mapId] ?? MAPS.default;
    this.data = parseMap(this.def);
    this.render();
  }

  render() {
    const { tileSize } = this.data;
    const oneWayHeight = Math.max(2, Math.floor(tileSize * 0.25));

    for (const r of this.data.solidRects) {
      this.scene.add.rectangle(
        r.x + r.w / 2,
        r.y + r.h / 2,
        r.w,
        r.h,
        COLORS.BONE,
      ).setDepth(1);
    }

    for (const r of this.data.oneWayRects) {
      this.scene.add.rectangle(
        r.x + r.w / 2,
        r.y + oneWayHeight / 2,
        r.w,
        oneWayHeight,
        COLORS.BONE,
      ).setDepth(1);
    }

    for (const h of this.data.hazards) {
      this.scene.add.rectangle(
        h.x + h.w / 2,
        h.y + h.h / 2,
        h.w,
        h.h,
        0xff5470,
      ).setDepth(1).setAlpha(0.85);
    }
  }

  get name() {
    return this.def.name;
  }
}
