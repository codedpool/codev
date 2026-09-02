import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
// Cache the connection across hot reloads / route invocations.
const g = globalThis;
g.__codevMongoose ||= { conn: null, promise: null };

export async function connectDB() {
  if (g.__codevMongoose.conn) return g.__codevMongoose.conn;
  if (!uri) throw Object.assign(new Error('MONGO_URI is not configured'), { status: 500 });
  if (!g.__codevMongoose.promise) {
    g.__codevMongoose.promise = mongoose.connect(uri, { bufferCommands: false }).then((m) => m);
  }
  g.__codevMongoose.conn = await g.__codevMongoose.promise;
  return g.__codevMongoose.conn;
}
