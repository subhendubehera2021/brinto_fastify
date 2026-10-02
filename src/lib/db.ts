import 'dotenv/config';
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

if (!mongoose.connection.listeners('error').length) {
  mongoose.connection.on('error', () => {
    // Gracefully swallow background socket errors
  });
}

let cachedPromise: Promise<typeof mongoose> | null = null;
let lastFailedAttempt = 0;
const RETRY_COOLDOWN_MS = 60_000;

export async function connectToDatabase(uri?: string) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const MONGODB_URI = uri || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn('MongoDB not connected (MONGODB_URI not set) — using offline fallback');
    return null;
  }

  if (cachedPromise && mongoose.connection.readyState === 2) {
    try {
      await cachedPromise;
      return mongoose.connection;
    } catch {
      cachedPromise = null;
    }
  }

  if (lastFailedAttempt && Date.now() - lastFailedAttempt < RETRY_COOLDOWN_MS) {
    return null;
  }

  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 1,
    autoIndex: false,
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 5000,
  };

  try {
    cachedPromise = mongoose.connect(MONGODB_URI, opts);
    await cachedPromise;
    lastFailedAttempt = 0;
    return mongoose.connection;
  } catch (err) {
    cachedPromise = null;
    lastFailedAttempt = Date.now();
    console.warn('MongoDB not connected — some features may not work:', (err as any)?.message || err);
    return null;
  }
}
