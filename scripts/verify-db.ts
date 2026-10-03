import "dotenv/config";
import pg from "pg";

async function verifyDatabaseSchema() {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log("=== VERIFYING POSTGRESQL DATABASE SCHEMA ===");

    // 1. Check PaymentMethod enum values
    const enumRes = await client.query(`
        SELECT e.enumlabel
        SELECT_ENUM: FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PaymentMethod';
    `.replace("SELECT_ENUM:", ""));
    const enumValues = enumRes.rows.map((r: any) => r.enumlabel);
    console.log("PaymentMethod Enum Values in DB:", enumValues);

    // 2. Check payment_transactions columns
    const ptColsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'payment_transactions'
        ORDER BY ordinal_position;
    `);
    console.log("\npayment_transactions Columns in DB:");
    console.table(ptColsRes.rows);

    // 3. Check user_wallets columns
    const uwColsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user_wallets'
        ORDER BY ordinal_position;
    `);
    console.log("\nuser_wallets Columns in DB:");
    console.table(uwColsRes.rows);

    // 4. Check wallet_histories columns
    const whColsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'wallet_histories'
        ORDER BY ordinal_position;
    `);
    console.log("\nwallet_histories Columns in DB:");
    console.table(whColsRes.rows);

    await client.end();
}

verifyDatabaseSchema().catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
});
