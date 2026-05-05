// Message names sent over the room (client -> server, server -> client).
// Server -> client state sync is automatic via Colyseus schemas.
export const MESSAGES = {
  STATE: 'state',
  SHOOT: 'shoot',
  HIT: 'hit',
  FLAG_TOGGLE: 'flag_toggle',
  CHOOSE_TEAM: 'choose_team',
  MATCH_END: 'match_end',
  CHANGE_MAP: 'change_map',
  MAP_CHANGED: 'map_changed',
  LOG: 'log',
};

export const LOG_EVENTS = {
  JOIN: 'join',
  LEAVE: 'leave',
  JOIN_TEAM: 'join_team',
  KILL: 'kill',
  CAPTURE: 'capture',
  MATCH_END: 'match_end',
  MAP_CHANGED: 'map_changed',
};

export const ROOM_NAME = 'boxfury';
