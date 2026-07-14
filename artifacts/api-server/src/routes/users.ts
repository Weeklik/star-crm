import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireOwner } from "../middlewares/requireAuth";
import {
  ListUsersResponse,
  UpdateUserRoleBody,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

const safeUserFields = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  role: usersTable.role,
  profilePicture: usersTable.profilePicture,
  dateOfJoining: usersTable.dateOfJoining,
  country: usersTable.country,
  currency: usersTable.currency,
  createdAt: usersTable.createdAt,
};

const ownerUserFields = {
  ...safeUserFields,
  passwordPlain: usersTable.passwordPlain,
};

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const body = z
    .object({
      name: z.string().min(1).optional(),
      profilePicture: z.string().nullable().optional(),
      dateOfJoining: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      currency: z.string().min(3).max(3).nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(body.data)
    .where(eq(usersTable.id, user.id))
    .returning(safeUserFields);

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(updated);
});

router.get(
  "/users",
  requireAuth,
  requireOwner,
  async (_req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const users = await db
      .select(ownerUserFields)
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(users);
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

// Owner: create a new salesperson account
router.post(
  "/users",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        country: z.string().nullable().optional(),
        currency: z.string().min(3).max(3).optional(),
      })
      .safeParse(req.body);

    if (!body.success) {
      res.status(400).json({ error: body.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, body.data.email.toLowerCase()))
      .then((rows) => rows[0]);

    if (existing) {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }

    const { default: bcrypt } = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(body.data.password, 8);

    const [created] = await db
      .insert(usersTable)
      .values({
        name: body.data.name,
        email: body.data.email.toLowerCase(),
        passwordHash,
        passwordPlain: body.data.password,
        role: "salesperson",
        country: body.data.country ?? null,
        currency: body.data.currency ?? "USD",
      })
      .returning(ownerUserFields);

    res.status(201).json(created);
  },
);

// Owner: change a user's password
router.patch(
  "/users/:id/password",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const idParam = z.coerce.number().int().safeParse(req.params.id);
    if (!idParam.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const body = z.object({ password: z.string().min(6) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const { default: bcrypt } = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(body.data.password, 8);

    const [updated] = await db
      .update(usersTable)
      .set({ passwordHash, passwordPlain: body.data.password })
      .where(eq(usersTable.id, idParam.data))
      .returning(ownerUserFields);

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updated);
  },
);

// Owner: update any user's country/currency
router.patch(
  "/users/:id/profile",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    req.log.info({ rawBody: req.body, params: req.params }, "PATCH /users/:id/profile received");

    const idParam = z.coerce.number().int().safeParse(req.params.id);
    if (!idParam.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const body = z
      .object({
        country: z.string().nullable().optional(),
        currency: z.string().min(3).max(3).nullable().optional(),
      })
      .safeParse(req.body);

    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    // The frontend always sends both fields; use them directly.
    // Raw SQL is used here because Drizzle's set() with Zod-inferred
    // optional types silently produces no SET clauses under some conditions.
    const countryVal = body.data.country ?? null;
    const currencyVal = body.data.currency ?? "USD";

    req.log.info({ userId: idParam.data, countryVal, currencyVal }, "Updating user profile via raw SQL");

    const result = await db.execute(sql`
      UPDATE users
      SET country = ${countryVal}, currency = ${currencyVal}
      WHERE id = ${idParam.data}
      RETURNING
        id,
        email,
        name,
        role,
        profile_picture   AS "profilePicture",
        date_of_joining   AS "dateOfJoining",
        country,
        currency,
        created_at        AS "createdAt"
    `);

    const updated = result.rows[0] as typeof safeUserFields | undefined;

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    req.log.info({ updated }, "User profile updated");
    res.json(updated);
  },
);

// Owner: delete a user and all their deals
router.delete(
  "/users/:id",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const owner = (req as any).user;
    const idParam = z.coerce.number().int().safeParse(req.params.id);
    if (!idParam.success) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    if (idParam.data === owner.id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const { dealsTable } = await import("@workspace/db");
    await db.delete(dealsTable).where(eq(dealsTable.salespersonId, idParam.data));
    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, idParam.data)).returning({ id: usersTable.id });

    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
