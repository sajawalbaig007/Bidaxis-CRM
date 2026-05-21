import { Router } from "express";

import { uploadReport } from "../controllers/reportUpload.controller";

import upload from "../middleware/upload.middleware";

import {
  verifyToken,
} from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  verifyToken,
  upload.single("file"),
  uploadReport
);

export default router;