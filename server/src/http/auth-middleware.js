import { verifyPrivyToken } from '../auth/privy.js';

// Express middleware: parses Bearer token, attaches { auth: { userId, claims } } on success.
// Does NOT reject anonymous traffic — route handlers decide via requireAuth().
export async function attachAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return next();
  const result = await verifyPrivyToken(match[1]);
  if (result) req.auth = result;
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.auth?.userId) {
    res.status(401).json({ error: 'auth required' });
    return;
  }
  return next();
}
