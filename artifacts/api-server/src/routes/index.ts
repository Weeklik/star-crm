import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import dealsRouter from "./deals";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(dealsRouter);
router.use(reportsRouter);

export default router;
