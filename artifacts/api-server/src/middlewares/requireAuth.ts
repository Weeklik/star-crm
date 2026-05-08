import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;

  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .then((rows) => rows[0]);

  if (!user) {
    const email = (auth as any)?.sessionClaims?.email ?? "";
    const name = (auth as any)?.sessionClaims?.fullName ?? null;
    const isFirstUser =
      (await db.select().from(usersTable)).length === 0;
    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email,
        name,
        role: isFirstUser ? "owner" : "salesperson",
      })
      .returning();
    user = created;
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
