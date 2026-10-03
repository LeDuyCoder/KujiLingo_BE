import "dotenv/config";
import pg from "pg";

async function main() {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log("Connected to DB, patching schema...");

    try {
        await client.query(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYOS';`);
    } catch (e: any) {
        console.log("PaymentMethod enum alter:", e.message);
    }

    try {
        await client.query(`ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "order_code" BIGINT;`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_order_code_key" ON "payment_transactions"("order_code");`);
    } catch (e: any) {
        console.log("order_code column alter:", e.message);
    }

    try {
        await client.query(`ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "qr_code" TEXT;`);
    } catch (e: any) {
        console.log("qr_code column alter:", e.message);
    }

    console.log("Database schema patched successfully!");
    await client.end();
}

main().catch((err) => {
    console.error("Patch DB error:", err);
    process.exit(1);
});
