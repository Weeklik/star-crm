import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS delivery_time text`);

console.log("✓ delivery_time column added to deals table");
await client.end();
