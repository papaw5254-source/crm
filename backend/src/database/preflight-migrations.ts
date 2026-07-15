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

    const { rows: debtPaymentRows } = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'debt_payments' AND column_name = 'debtor_id'
    `);
    if (debtPaymentRows.length > 0 && debtPaymentRows[0].data_type !== 'uuid') {
      // debt_payments rows whose debtor was deleted before the FK existed were
      // never cleaned up (the old phantom join column meant CASCADE never fired),
      // and they'd violate the new FK constraint below, so drop them first.
      await client.query(`
        DELETE FROM debt_payments dp
        WHERE NOT EXISTS (SELECT 1 FROM debtors d WHERE d.id::text = dp.debtor_id)
      `);
      await client.query(
        `ALTER TABLE debt_payments ALTER COLUMN debtor_id TYPE uuid USING debtor_id::uuid`,
      );
      console.log('✅ Migrated debt_payments.debtor_id to uuid (and removed orphaned payments)');
    }

    // Same phantom-join-column issue as prepayment_deliveries above.
    await client.query(`ALTER TABLE debt_payments DROP COLUMN IF EXISTS "debtorId"`);

    const { rows: expenseCategoryRows } = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'category'
    `);
    if (expenseCategoryRows.length > 0 && expenseCategoryRows[0].data_type !== 'character varying') {
      await client.query(`ALTER TABLE expenses ALTER COLUMN category TYPE varchar USING category::text`);
      console.log('✅ Migrated expenses.category from enum to free text');
    }
  } finally {
    await client.end();
  }
}
