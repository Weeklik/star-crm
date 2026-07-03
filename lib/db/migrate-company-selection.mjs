import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();
await client.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_selection text;`);
console.log("✓ company_selection column added");
await client.end();
