import express from "express";
import { uploadExcel } from "../middleware/upload.middleware";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import {
  uploadLeads,
  getLatestUpload,
} from "../controllers/upload.controller";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.post("/", uploadExcel.single("file"), uploadLeads);
router.get("/latest", getLatestUpload);

export default router;
