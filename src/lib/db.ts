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

  // Optimized for Cloudflare Workers & Serverless:
  // - maxPoolSize: 5 for handling concurrent queries without socket exhaustion
  // - serverMonitoringMode: 'poll' disables persistent background streaming SDAM connections
  // - heartbeatFrequencyMS: 300000 prevents background socket wakeups while worker is idle
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
