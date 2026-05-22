import express from "express";

import upload from "../middleware/upload.middleware";

import {
  uploadLeads,
  getLatestUpload,
} from "../controllers/upload.controller";

const router =
  express.Router();

/* ================= UPLOAD ================= */

router.post(
  "/",
  upload.single("file"),
  uploadLeads
);

/* ================= LATEST ================= */

router.get(
  "/latest",
  getLatestUpload
);

export default router;
