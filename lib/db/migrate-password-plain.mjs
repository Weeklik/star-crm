import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain text`);

console.log("✓ password_plain column added to users table");
await client.end();
