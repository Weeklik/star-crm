import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS activities (
    id serial PRIMARY KEY,
    salesperson_id integer NOT NULL,
    date text NOT NULL,
    time text NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location_name text,
    company text,
    product text,
    meeting_person text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);

console.log("✓ activities table ready");
await client.end();
