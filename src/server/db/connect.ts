import { connectToDatabase } from '@/app/lib/mongoose';

export async function connectMongo() {
  return connectToDatabase();
}
