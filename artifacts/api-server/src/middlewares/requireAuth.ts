import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { CachedUser } from "../app";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Use cached user from session to avoid a DB round-trip on every request.
  // Re-fetch from DB only if the cache is missing (e.g. first request after login
  // on an old session, or after a server restart).
  let user: CachedUser | undefined = req.session.cachedUser;

  if (!user) {
    const row = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((rows) => rows[0]);

    if (!row) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { passwordHash: _, ...safeUser } = row;
    user = safeUser as CachedUser;
    req.session.cachedUser = user;
  }

  (req as any).user = user;
  next();
}

export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = (req as any).user;
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Forbidden: owner access required" });
    return;
  }
  next();
}
