import { PrismaClient } from '@prisma/client';

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '15');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '20');
    }
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '10');
    }
    return parsed.toString();
  } catch {
    let result = url;
    if (!result.includes('connect_timeout')) {
      result += (result.includes('?') ? '&' : '?') + 'connect_timeout=15';
    }
    if (!result.includes('pool_timeout')) {
      result += (result.includes('?') ? '&' : '?') + 'pool_timeout=20';
    }
    if (!result.includes('connection_limit')) {
      result += (result.includes('?') ? '&' : '?') + 'connection_limit=10';
    }
    return result;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Retries a database operation if it hits a transient connection timeout (P1001 / P1002)
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 300
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const errorObj = err as { code?: string; message?: string; name?: string } | null;
      const code = errorObj?.code;
      const name = errorObj?.name || '';
      const msg = errorObj?.message || '';

      const isConnectionError =
        code === 'P1001' ||
        code === 'P1002' ||
        code === 'P1017' ||
        code === 'P2024' ||
        name === 'PrismaClientInitializationError' ||
        msg.includes('Server has closed the connection') ||
        msg.includes("Can't reach database server") ||
        msg.includes('connection timed out') ||
        msg.includes('Connection closed') ||
        msg.includes('Timed out fetching a new connection');

      if (attempt <= retries && isConnectionError) {
        console.warn(`[Prisma] Connection retry ${attempt}/${retries} (${name || code || 'error'})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

export default prisma;

