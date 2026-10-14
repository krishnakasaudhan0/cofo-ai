import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export async function initDb() {
  try {
    await prisma.$connect();
    console.log('Connected to Neon PostgreSQL successfully.');
  } catch (err) {
    console.error('Failed to connect to Neon PostgreSQL:', err.message);
  }
}
