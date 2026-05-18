import { API_BASE_URL } from './config.js';

export async function fetchMyProfile(accessToken) {
  const res = await fetch(`${API_BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`fetchMyProfile failed: ${res.status}`);
  return res.json();
}

export async function patchMyUsername(accessToken, username) {
  const res = await fetch(`${API_BASE_URL}/api/me/username`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(`patchMyUsername failed: ${res.status}`);
  return res.json();
}
