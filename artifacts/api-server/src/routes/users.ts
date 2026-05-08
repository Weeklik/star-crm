import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireOwner } from "../middlewares/requireAuth";
import {
  ListUsersResponse,
  GetMeResponse,
  UpdateUserRoleBody,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { passwordHash: _, ...safeUser } = user;
  res.json(GetMeResponse.parse(safeUser));
});

router.get(
  "/users",
  requireAuth,
  requireOwner,
  async (_req, res): Promise<void> => {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(ListUsersResponse.parse(users));
  },
);

router.patch(
  "/users/:id/role",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const idParam = z.coerce.number().int().safeParse(req.params.id);
    if (!idParam.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const body = UpdateUserRoleBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role: body.data.role })
      .where(eq(usersTable.id, idParam.data))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(UpdateUserRoleResponse.parse(updated));
  },
);

export default router;
