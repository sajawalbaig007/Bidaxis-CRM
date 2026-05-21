import { Router } from "express";

import {
  uploadReport,
  deleteReport,
} from "../controllers/reportUpload.controller";

import upload from "../middleware/upload.middleware";

import {
  verifyToken,
} from "../middleware/auth.middleware";

const router = Router();

/* UPLOAD REPORT */

router.post(
  "/",
  verifyToken,
  upload.single("file"),
  uploadReport
);

/* DELETE REPORT */

router.delete(
  "/:id",
  verifyToken,
  deleteReport
);

export default router;