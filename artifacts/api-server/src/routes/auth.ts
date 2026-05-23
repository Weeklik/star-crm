import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";
import type { CachedUser } from "../app";

const router: IRouter = Router();

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
