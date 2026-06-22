import express from "express";
import { uploadExcel } from "../middleware/upload.middleware";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import {
  uploadLeads,
  getLatestUpload,
  previewUpload,
  getUploadHistory,
  deleteUploadFile,
} from "../controllers/upload.controller";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.post("/", uploadExcel.single("file"), uploadLeads);
router.post("/preview", uploadExcel.single("file"), previewUpload);
router.get("/latest", getLatestUpload);
router.get("/history", getUploadHistory);
router.delete("/:id", deleteUploadFile);

export default router;
