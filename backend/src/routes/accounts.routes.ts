import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { uploadReportFile } from "../middleware/upload.middleware";
import {
  getAccountsDashboardSummary,
  getAccountsRecord,
  listAccountsDates,
  saveAccountsRecord,
  uploadAccountsFile,
} from "../controllers/accounts.controller";

const router = express.Router();

router.use(verifyToken, allowRoles("accounts", "admin"));

router.get("/dashboard/summary", getAccountsDashboardSummary);
router.get("/:page", listAccountsDates);
router.get("/:page/:date", getAccountsRecord);
router.put("/:page/:date", saveAccountsRecord);
router.post("/:page/:date/upload", uploadReportFile.single("file"), uploadAccountsFile);

export default router;
