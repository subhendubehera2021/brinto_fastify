import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

// Global error listener to prevent uncaught socket exceptions
if (!mongoose.connection.listeners('error').length) {
  mongoose.connection.on('error', (err) => {
    console.warn('Mongoose background connection error:', (err as any)?.message || err);
  });
}

let connectingPromise: Promise<mongoose.Connection | null> | null = null;

export async function connectToDatabase(uri?: string): Promise<mongoose.Connection | null> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const MONGODB_URI = uri || process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn('MongoDB not connected (MONGODB_URI not set)');
    return null;
  }

  // Reuse ongoing connection attempt across concurrent requests
  if (connectingPromise) {
    try {
      const conn = await connectingPromise;
      if (conn && (mongoose.connection.readyState as number) === 1) {
        return conn;
      }
    } catch {
      // Continue below to initiate fresh attempt if needed
    }
  }

  // If connected during wait
  if ((mongoose.connection.readyState as number) === 1) {
    return mongoose.connection;
  }

  const opts: mongoose.ConnectOptions = {
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 60000,
    autoIndex: false,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 8000,
  };

  connectingPromise = (async () => {
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
      connectingPromise = null;
    }
  })();

  return await connectingPromise;
}

// Pre-warm database connection
if (process.env.MONGODB_URI) {
  connectToDatabase(process.env.MONGODB_URI).catch(() => {});
}
