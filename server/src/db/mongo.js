import mongoose from 'mongoose';
import { SERVER_CONFIG, hasDbConfig } from '../config/index.js';

let connectPromise = null;

export function connectMongo() {
  if (!hasDbConfig()) {
    console.warn('[mongo] MONGODB_URI not set — DB features disabled');
    return Promise.resolve(null);
  }
  if (connectPromise) return connectPromise;

  connectPromise = mongoose
    .connect(SERVER_CONFIG.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    })
    .then((conn) => {
      console.log(`[mongo] connected to ${conn.connection.name}`);
      return conn;
    })
    .catch((err) => {
      console.error('[mongo] connection failed:', err.message);
      connectPromise = null;
      throw err;
    });

  return connectPromise;
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}
