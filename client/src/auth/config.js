export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

export const AUTH_EVENTS = {
  READY: 'boxfury:auth:ready',
  LOGIN: 'boxfury:auth:login',
  LOGOUT: 'boxfury:auth:logout',
  PROFILE: 'boxfury:auth:profile',
};
