import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import dealsRouter from "./deals";
import reportsRouter from "./reports";
import lookupRouter from "./lookup";
import plannerRouter from "./planner";
import productsRouter from "./products";
import activitiesRouter from "./activities";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(dealsRouter);
router.use(reportsRouter);
router.use(lookupRouter);
router.use(plannerRouter);
router.use(productsRouter);
router.use(activitiesRouter);
router.use(leadsRouter);

export default router;
