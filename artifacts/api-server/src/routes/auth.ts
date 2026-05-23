import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";
import type { CachedUser } from "../app";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const TARGET_ROUNDS = 8;

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const body = LoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid email or password format" });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, body.data.email.toLowerCase()))
    .then((rows) => rows[0]);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Transparently upgrade high-cost hashes in the background so subsequent
  // logins are much faster (cost 10 → 8 saves ~2 s on shared CPU).
  const currentRounds = bcrypt.getRounds(user.passwordHash);
  if (currentRounds > TARGET_ROUNDS) {
    bcrypt.hash(body.data.password, TARGET_ROUNDS).then((newHash) =>
      db
        .update(usersTable)
        .set({ passwordHash: newHash })
        .where(eq(usersTable.id, user.id))
        .then(() => logger.info({ userId: user.id }, "Password hash upgraded to lower cost factor"))
        .catch((err) => logger.warn({ err }, "Hash upgrade failed")),
    );
  }

  const { passwordHash: _, ...safeUser } = user;

  req.session.userId = user.id;
  req.session.cachedUser = safeUser as CachedUser;

  res.json(safeUser);
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  req.session.destroy(() => {});
  res.status(204).send();
});

export default router;
