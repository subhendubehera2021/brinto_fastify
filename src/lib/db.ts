import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

// Global error listener to prevent unhandled background socket crashes
if (!mongoose.connection.listeners('error').length) {
  mongoose.connection.on('error', (err) => {
    console.warn('Mongoose background connection error:', (err as any)?.message || err);
  });
}

let activeConnectingPromise: Promise<mongoose.Connection | null> | null = null;

export async function connectToDatabase(uri?: string): Promise<mongoose.Connection | null> {
  if ((mongoose.connection.readyState as number) === 1) {
    return mongoose.connection;
  }

  const MONGODB_URI = uri || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn('MongoDB not connected (MONGODB_URI not set)');
    return null;
  }

  // If a connection is currently being established, wait for it
  if (activeConnectingPromise) {
    try {
      const conn = await activeConnectingPromise;
      if (conn && (mongoose.connection.readyState as number) === 1) {
        return conn;
      }
    } catch {
      // Continue to fresh attempt if previous attempt failed
    }
  }

  if ((mongoose.connection.readyState as number) === 1) {
    return mongoose.connection;
  }

  const opts: any = {
    bufferCommands: false,
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    serverMonitoringMode: 'poll',
    heartbeatFrequencyMS: 300000,
    autoIndex: false,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 8000,
  };

  activeConnectingPromise = (async () => {
    try {
      if ((mongoose.connection.readyState as number) === 1) {
        return mongoose.connection;
      }
      await mongoose.connect(MONGODB_URI, opts);
      return mongoose.connection;
    } catch (err: any) {
      console.warn('MongoDB connection error:', err?.message || err);
      return null;
    } finally {
      activeConnectingPromise = null;
    }
  })();

  return await activeConnectingPromise;
}

/**
 * Executes a database operation with complete request-context isolation in Cloudflare Workers.
 * In Cloudflare Workers, outbound TCP sockets cannot be shared across different requests.
 * By using a request-scoped client with automatic cleanup, every request runs in its own socket context.
 */
export async function withMongoCollection<T>(
  collectionName: string,
  operation: (collection: any) => Promise<T>
): Promise<T> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const isCloudflare = typeof (globalThis as any).caches !== 'undefined';

  if (isCloudflare) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverMonitoringMode: 'poll',
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
    });

    try {
      await client.connect();
      const match = MONGODB_URI.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
      const dbName = match ? match[1] : 'brinto';
      const collection = client.db(dbName).collection(collectionName);
      return await operation(collection);
    } finally {
      await client.close().catch(() => {});
    }
  }

  // Node.js server fallback: use pooled Mongoose connection
  await connectToDatabase(MONGODB_URI);
  const collection = mongoose.connection.collection(collectionName);
  return await operation(collection);
}
