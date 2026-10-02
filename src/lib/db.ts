import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

if (!mongoose.connection.listeners('error').length) {
  mongoose.connection.on('error', () => {
    // Gracefully swallow background socket errors
  });
}

interface MongooseGlobalCache {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
  lastFailedAttempt: number;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseGlobalCache;
};

const cache: MongooseGlobalCache = globalWithMongoose.__mongooseCache || {
  conn: null,
  promise: null,
  lastFailedAttempt: 0,
};
globalWithMongoose.__mongooseCache = cache;

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

  if (cache.promise && mongoose.connection.readyState === 2) {
    try {
      await cache.promise;
      return mongoose.connection;
    } catch {
      cache.promise = null;
    }
  }

  if (cache.lastFailedAttempt && Date.now() - cache.lastFailedAttempt < RETRY_COOLDOWN_MS) {
    return null;
  }

  const opts: mongoose.ConnectOptions = {
    bufferCommands: false,
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 60000,
    autoIndex: false,
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 5000,
  };

  try {
    cache.promise = mongoose.connect(MONGODB_URI, opts);
    await cache.promise;
    cache.conn = mongoose.connection;
    cache.lastFailedAttempt = 0;
    return cache.conn;
  } catch (err) {
    cache.promise = null;
    cache.lastFailedAttempt = Date.now();
    console.warn('MongoDB not connected — some features may not work:', (err as any)?.message || err);
    return null;
  }
}

// Pre-warm database connection during serverless cold-start initialization
if (process.env.MONGODB_URI) {
  connectToDatabase(process.env.MONGODB_URI).catch(() => {});
}
