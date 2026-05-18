import { PrivyClient } from '@privy-io/server-auth';
import { SERVER_CONFIG, hasAuthConfig } from '../config/index.js';

let client = null;

export function getPrivyClient() {
  if (!hasAuthConfig()) return null;
  if (!client) {
    client = new PrivyClient(SERVER_CONFIG.PRIVY_APP_ID, SERVER_CONFIG.PRIVY_APP_SECRET);
  }
  return client;
}

// Verifies a Privy access token and returns { userId } or null.
// Never throws — callers decide how to respond to anonymous traffic.
export async function verifyPrivyToken(token) {
  const c = getPrivyClient();
  if (!c || !token) return null;
  try {
    const claims = await c.verifyAuthToken(token);
    return { userId: claims.userId, claims };
  } catch (err) {
    console.warn('[privy] token verify failed:', err.message);
    return null;
  }
}

// Pulls full user info (email, wallet, etc.) — costs a Privy API call,
// so use only when persisting/refreshing a profile, not on every request.
export async function fetchPrivyUser(userId) {
  const c = getPrivyClient();
  if (!c || !userId) return null;
  try {
    return await c.getUser(userId);
  } catch (err) {
    console.warn('[privy] fetchPrivyUser failed:', err.message);
    return null;
  }
}
