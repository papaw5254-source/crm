import { Client } from 'pg';

/**
 * Runs before TypeORM's synchronize() on every boot. synchronize() changes an
 * existing NOT NULL column's type by dropping and re-adding it, which fails
 * (and crash-loops the app) once the table has data. Column type fixes that
 * synchronize can't perform safely go here instead, guarded so they're a
 * no-op once already applied.
 */
export async function runPreflightMigrations(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'brick_factory_crm',
  });
  await client.connect();

  try {
    const { rows } = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'prepayment_deliveries' AND column_name = 'prepayment_id'
    `);
    if (rows.length > 0 && rows[0].data_type !== 'uuid') {
      await client.query(
        `ALTER TABLE prepayment_deliveries ALTER COLUMN prepayment_id TYPE uuid USING prepayment_id::uuid`,
      );
      console.log('✅ Migrated prepayment_deliveries.prepayment_id to uuid');
    }

    // Before @JoinColumn was added, TypeORM auto-created a separate, always-empty
    // camelCase join column alongside the real snake_case one. Drop the orphan.
    await client.query(`ALTER TABLE prepayment_deliveries DROP COLUMN IF EXISTS "prepaymentId"`);
  } finally {
    await client.end();
  }
}
