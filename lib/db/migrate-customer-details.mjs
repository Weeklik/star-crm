import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_address text`);
await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_phone text`);
await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_email text`);
await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_trn text`);

console.log("✅ customer_address, customer_phone, customer_email, customer_trn columns added");
await client.end();
