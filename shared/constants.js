export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const NETWORK = {
  SEND_RATE: 60,
  PATCH_RATE: 60,
  INTERP_DELAY_MS: 60,
};

export const PLAYER = {
  SPEED: 270,
  CARRY_SPEED: 200,
  JUMP_SPEED: 450,
  JUMP_COOLDOWN_MS: 280,
  WIDTH: 24,
  HEIGHT: 48,
  BODY_SLACK_X: 2,
  MAX_HP: 100,
  PICKUP_RADIUS: 56,
};

export const BOW = {
  LENGTH: 28,
  THICKNESS: 3,
  MIN_ANGLE: 45,
  MAX_ANGLE: 180,
  CHARGE_RATE: 180,
};

export const ARROW = {
  SPEED: 700,
  DAMAGE: 25,
  LIFETIME_MS: 3000,
  LENGTH: 18,
  THICKNESS: 2,
  KNOCKBACK_MULT: 0.45,
  KNOCKBACK_UP: 140,
  COOLDOWN_MS: 300,
};

export const PHYSICS = {
  GRAVITY: 900,
  TICK_HZ: 60,
};

export const HIT = {
  FLASH_MS: 90,
  IFRAMES_MS: 250,
  INPUT_LOCK_MS: 150,
};

export const RESPAWN = {
  COOLDOWN_MS: 5000,
};

export const SPAWN_PROTECTION = {
  DURATION_MS: 5000,
};

export const FLAG = {
  POLE_HEIGHT: 34,
  POLE_WIDTH: 2,
  CARRY_OFFSET_Y: -41,
};

export const SCORE = {
  CAPTURE_RADIUS: 64,
  TARGET: 10,
};

export const DEATHMATCH = {
  KILLS_TO_WIN: 5,
};

export const BEE = {
  WIDTH: 20,
  HEIGHT: 20,
  HP: 30,
  COLOR: 0xffd84e,
  SPEED: 220,
  ACCEL: 800,
  DAMPING: 1.6,
  HOVER_DISTANCE: 70,
  SIGHT_RANGE: 1200,
  BOB_AMPLITUDE: 8,
  BOB_FREQUENCY: 2.4,
};

export const ROOM = {
  MAX_CLIENTS: 8,
};

export const COLORS = {
  P1_JADE: 0x4ee08a,
  P2_CRIMSON: 0xff5470,
  P3_AZURE: 0x4eb1ff,
  P4_AMBER: 0xffd84e,
  DEEP: 0x15151f,
  BONE: 0xf5f5f0,
  ARENA: 0x1f1f2c,
};

export const PLAYER_COLORS = [
  COLORS.P1_JADE,
  COLORS.P2_CRIMSON,
  COLORS.P3_AZURE,
  COLORS.P4_AMBER,
];

export const GAME = {
  ZOOM_ENABLED: true,
  ZOOM: 1.8,
  CAMERA_LERP: 0.12,
};
