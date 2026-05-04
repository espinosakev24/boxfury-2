export const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8];
export const MAX_POINTS_OPTIONS = [1, 5, 10, 15];
export const MODES = ['ctf'];
export const DEFAULT_MAX_PLAYERS = 8;
export const DEFAULT_MAX_POINTS = 10;
export const DEFAULT_MODE = 'ctf';

export function normalizeMaxPlayers(v) {
  return MAX_PLAYERS_OPTIONS.includes(Number(v)) ? Number(v) : DEFAULT_MAX_PLAYERS;
}

export function normalizeMaxPoints(v) {
  return MAX_POINTS_OPTIONS.includes(Number(v)) ? Number(v) : DEFAULT_MAX_POINTS;
}

export function normalizeMode(v) {
  return MODES.includes(v) ? v : DEFAULT_MODE;
}
