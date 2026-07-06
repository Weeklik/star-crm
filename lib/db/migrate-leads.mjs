import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS leads (
    id                  serial PRIMARY KEY,
    lead_source         text NOT NULL,
    date_time           timestamptz NOT NULL DEFAULT now(),
    customer_name       text NOT NULL,
    company_name        text,
    mobile_country_code text NOT NULL DEFAULT '+971',
    mobile_number       text NOT NULL,
    email               text,
    region              text NOT NULL,
    brand               text NOT NULL,
    model               text NOT NULL,
    closure             text NOT NULL,
    notes               text,
    assigned_to_id      integer NOT NULL,
    lead_status         text NOT NULL DEFAULT 'New',
    next_follow_up_date date NOT NULL,
    follow_up_remarks   text,
    created_by_id       integer NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
  )
`);

console.log("✓ leads table ready");
await client.end();
