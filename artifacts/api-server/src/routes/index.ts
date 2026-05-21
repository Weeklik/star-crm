import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import dealsRouter from "./deals";
import reportsRouter from "./reports";
import lookupRouter from "./lookup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(dealsRouter);
router.use(reportsRouter);
router.use(lookupRouter);

export default router;
