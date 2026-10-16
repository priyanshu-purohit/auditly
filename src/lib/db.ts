import mongoose from "mongoose";

/**
 * One shared MongoDB connection.
 *
 * Next.js reloads modules constantly in development, so the connection is
 * stashed on globalThis. Without this you get a new connection on every file
 * save and Atlas closes the door after a few dozen of them.
 */
type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  auditlyMongoose?: ConnectionCache;
};

const cache: ConnectionCache =
  globalForMongoose.auditlyMongoose ?? { conn: null, promise: null };
globalForMongoose.auditlyMongoose = cache;

export function mongoUri(): string {
  return (process.env.MONGODB_URI ?? "").trim();
}

export function mongoDbName(): string {
  const value = (process.env.MONGODB_DB ?? "").trim();
  return value === "" ? "auditly" : value;
}

/** True when a connection string is configured at all. */
export function isDatabaseConfigured(): boolean {
  return mongoUri() !== "";
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn !== null) return cache.conn;

  const uri = mongoUri();
  if (uri === "") {
    throw new Error("MONGODB_URI is empty in .env.local");
  }

  if (cache.promise === null) {
    cache.promise = mongoose.connect(uri, {
      dbName: mongoDbName(),
      bufferCommands: false,
      // Fail fast instead of hanging the page for 30 seconds.
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (cause) {
    // Clear the failed attempt so the next request can try again.
    cache.promise = null;
    throw cause;
  }

  return cache.conn;
}
