import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import memorystore from "memorystore";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import { existsSync } from "fs";
import { pool } from "@workspace/db";

const MemoryStore = memorystore(session);

export interface CachedUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  profilePicture: string | null;
  dateOfJoining: string | null;
  country: string | null;
  currency: string | null;
  createdAt: Date;
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    cachedUser: CachedUser;
  }
}

const app: Express = express();

// Trust the reverse proxy (AWS App Runner, etc.) so that secure session cookies
// are set correctly when SSL is terminated at the load balancer level.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

app.use(
  session({
    store: new MemoryStore({
      checkPeriod: 60 * 60 * 1000, // prune expired entries every hour
      ttl: SESSION_TTL_MS,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
    },
  }),
);

app.use("/api", router);

// ── DB warmup + indexes ───────────────────────────────────────────────────────
// Warm the Neon connection immediately on startup so the first real user
// request doesn't pay the 2-3 s cold-start penalty.
// Also create indexes if they don't exist yet (idempotent).
async function warmDb() {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_salesperson_id   ON deals (salesperson_id);
      CREATE INDEX IF NOT EXISTS idx_deals_deal_start_date  ON deals (deal_start_date);
      CREATE INDEX IF NOT EXISTS idx_deals_stage            ON deals (stage);
      CREATE INDEX IF NOT EXISTS idx_deals_region           ON deals (region);
      CREATE INDEX IF NOT EXISTS idx_deals_sp_date          ON deals (salesperson_id, deal_start_date);
      SELECT 1;
    `);
    logger.info("DB warmed and indexes verified");
  } catch (err) {
    logger.warn({ err }, "DB warmup failed — will retry on next keepalive");
  }
}

// Run warmup at startup (non-blocking)
warmDb();

// Keep Neon alive: ping every 4 minutes so the serverless compute
// never goes cold between user requests (Neon sleeps after ~5 min idle).
setInterval(() => {
  pool.query("SELECT 1").catch((err) => logger.warn({ err }, "DB keepalive failed"));
}, 4 * 60 * 1000);

// Serve React frontend static files when built (production)
// Check multiple locations: Docker copies to ./public, managed runtime builds to ./artifacts/star-crm/dist/public
const publicDirCandidates = [
  path.resolve(process.cwd(), "public"),
  path.resolve(process.cwd(), "artifacts/star-crm/dist/public"),
];
const publicDir = publicDirCandidates.find(existsSync);
if (publicDir) {
  logger.info({ publicDir }, "Serving frontend static files");
  app.use(express.static(publicDir));
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
