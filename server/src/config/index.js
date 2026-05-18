import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
dotenv.config({ path: resolve(repoRoot, '.env') });

export const SERVER_CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  PRIVY_APP_ID: process.env.PRIVY_APP_ID || '',
  PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET || '',
};

export function hasAuthConfig() {
  return Boolean(SERVER_CONFIG.PRIVY_APP_ID && SERVER_CONFIG.PRIVY_APP_SECRET);
}

export function hasDbConfig() {
  return Boolean(SERVER_CONFIG.MONGODB_URI);
}
