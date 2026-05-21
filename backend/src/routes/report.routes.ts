import { Router } from "express";

import { getReports } from "../controllers/report.controller";

const router = Router();

router.get(
  "/",
  getReports
);

export default router;