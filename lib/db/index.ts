import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import type { ProspectRow } from './schema';

type DB = NeonHttpDatabase<typeof schema>;
let _db: DB | null = null;

/**
 * Neon Postgres (via Vercel Marketplace) when DATABASE_URL is set; otherwise,
 * in local dev only, an embedded PGlite database in ./.pglite so the whole
 * pipeline runs with zero setup. Both speak the same Drizzle API.
 */
export function db(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (url) {
    _db = drizzleNeon(neon(url), { schema });
  } else if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/pglite');
    // Next bundles route handlers, pages and workflow steps separately; share
    // one PGlite instance per process, since it can't be opened twice.
    const g = globalThis as { __pglite?: unknown };
    g.__pglite ??= new PGlite(localDbPath());
    _db = drizzle(g.__pglite, { schema }) as DB;
  } else {
    throw new Error('DATABASE_URL is not set (add Neon via the Vercel Marketplace)');
  }
  return _db!;
}

export const localDbPath = () => `${process.cwd()}/.pglite`;

export { schema };

type ProspectPatch = Partial<Omit<ProspectRow, 'domain' | 'createdAt' | 'updatedAt'>>;

export async function upsertProspect(domain: string, patch: ProspectPatch) {
  await db()
    .insert(schema.prospects)
    .values({ domain, ...patch })
    .onConflictDoUpdate({
      target: schema.prospects.domain,
      set: { ...patch, updatedAt: sql`now()` }
    });
}

export async function getProspect(domain: string) {
  const rows = await db()
    .select()
    .from(schema.prospects)
    .where(eq(schema.prospects.domain, domain))
    .limit(1);
  return rows[0] ?? null;
}
