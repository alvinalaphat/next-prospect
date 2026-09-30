import { config } from 'dotenv';

config({ path: '.env.local' });

/** Apply ./drizzle migrations to Neon (DATABASE_URL) or local PGlite. */
async function main() {
  const migrationsFolder = './drizzle';
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder });
    console.log('✓ Migrated Neon');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const client = new PGlite(`${process.cwd()}/.pglite`);
    await migrate(drizzle(client), { migrationsFolder });
    await client.close();
    console.log('✓ Migrated local PGlite (.pglite)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
