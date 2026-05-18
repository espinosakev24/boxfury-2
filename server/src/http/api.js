import express from 'express';
import { PlayerProfile } from '../db/models/PlayerProfile.js';
import { fetchPrivyUser } from '../auth/privy.js';
import { isMongoReady } from '../db/mongo.js';
import { attachAuth, requireAuth } from './auth-middleware.js';

export function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use(attachAuth);

  router.get('/health', (_req, res) => {
    res.json({ ok: true, db: isMongoReady() });
  });

  // First call after login: returns the player profile, creating it if it doesn't exist.
  router.get('/me', requireAuth, async (req, res) => {
    if (!isMongoReady()) return res.status(503).json({ error: 'db unavailable' });
    try {
      const profile = await getOrCreateProfile(req.auth.userId);
      res.json(profile.toClientJSON());
    } catch (err) {
      console.error('[api /me] error:', err);
      res.status(500).json({ error: 'profile load failed' });
    }
  });

  router.patch('/me/username', requireAuth, async (req, res) => {
    if (!isMongoReady()) return res.status(503).json({ error: 'db unavailable' });
    const raw = String(req.body?.username ?? '').trim().slice(0, 16);
    if (!raw) return res.status(400).json({ error: 'username required' });
    try {
      const profile = await getOrCreateProfile(req.auth.userId);
      profile.username = raw;
      profile.lastSeenAt = new Date();
      await profile.save();
      res.json(profile.toClientJSON());
    } catch (err) {
      console.error('[api /me/username] error:', err);
      res.status(500).json({ error: 'username update failed' });
    }
  });

  return router;
}

async function getOrCreateProfile(privyId) {
  const existing = await PlayerProfile.findOne({ privyId });
  if (existing) {
    existing.lastSeenAt = new Date();
    await existing.save();
    return existing;
  }

  // First time we see this user — backfill email/wallet from Privy.
  const user = await fetchPrivyUser(privyId);
  const email = user?.email?.address || user?.google?.email || '';
  const walletAddress = user?.wallet?.address || '';
  const fallbackName = email ? email.split('@')[0].slice(0, 16) : `Player-${privyId.slice(-4)}`;

  const created = await PlayerProfile.create({
    privyId,
    username: fallbackName,
    email,
    walletAddress,
    coins: 0,
  });
  console.log(`[api] created profile for ${privyId} (${email || walletAddress || 'no contact'})`);
  return created;
}
