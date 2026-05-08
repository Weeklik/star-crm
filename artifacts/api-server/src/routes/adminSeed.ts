import { Router, type IRouter } from "express";
import { createClerkClient } from "@clerk/express";

const router: IRouter = Router();

router.post("/admin/__seed-clerk-users", async (req, res): Promise<void> => {
  // Log all env keys to diagnose availability
  const allKeys = Object.keys(process.env).filter(k => k.includes("CLERK") || k.includes("SECRET"));
  const secret = process.env["CLERK_SECRET_KEY"];
  if (!secret) {
    res.status(500).json({ error: "CLERK_SECRET_KEY not set", availableClerkKeys: allKeys });
    return;
  }

  const clerk = createClerkClient({ secretKey: secret });

  const results: any[] = [];

  const accounts = [
    {
      emailAddress: ["owner@starcrm.com"],
      password: "StarOwner@2026",
      firstName: "Alex",
      lastName: "Johnson",
    },
    {
      emailAddress: ["sales@starcrm.com"],
      password: "StarSales@2026",
      firstName: "Sarah",
      lastName: "Mitchell",
    },
  ];

  for (const account of accounts) {
    try {
      const existing = await clerk.users.getUserList({
        emailAddress: account.emailAddress,
      });
      if (existing.totalCount > 0) {
        results.push({ email: account.emailAddress[0], status: "already_exists", clerkId: existing.data[0].id });
        continue;
      }
      const user = await clerk.users.createUser(account);
      results.push({ email: account.emailAddress[0], status: "created", clerkId: user.id });
    } catch (err: any) {
      results.push({ email: account.emailAddress[0], status: "error", message: err.message });
    }
  }

  res.json({ results });
});

export default router;
