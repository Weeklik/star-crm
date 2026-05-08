import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((rows) => rows[0]);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Unauthorized" });
    return;
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
