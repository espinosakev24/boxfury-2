import { WORLD } from '@boxfury/shared';

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.platforms = scene.physics.add.staticGroup();

    const platform = scene.add.rectangle(
      WORLD.WIDTH / 2,
      WORLD.HEIGHT / 2,
      WORLD.WIDTH * 0.6,
      8,
      0xffffff,
    );
    this.platforms.add(platform);
  }
}
