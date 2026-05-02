// Message names sent over the room (client -> server, server -> client).
// Server -> client state sync is automatic via Colyseus schemas.
export const MESSAGES = {
  STATE: 'state',
  SHOOT: 'shoot',
  HIT: 'hit',
  FLAG_TOGGLE: 'flag_toggle',
};

export const ROOM_NAME = 'boxfury';
