import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

/**
 * Empty opportunities, prospects, and the PageSpeed cache so a batch starts
 * from nothing. Schema and migration history stay intact.
 * Schema stays. Neon when DATABASE_URL is set, otherwise local PGlite.
 *
 *   pnpm db:reset
 */
async function main() {
  // Include the child table explicitly so Postgres can truncate the complete
  // foreign-key group without CASCADE affecting anything outside this app.
  const wipe = sql`truncate table opportunities, prospects, psi_cache`;
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    await drizzle(neon(process.env.DATABASE_URL)).execute(wipe);
    console.log('✓ Wiped opportunities, prospects, and psi_cache on Neon');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const client = new PGlite(`${process.cwd()}/.pglite`);
    await drizzle(client).execute(wipe);
    await client.close();
    console.log('✓ Wiped opportunities, prospects, and psi_cache in local PGlite (.pglite)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
