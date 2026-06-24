"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_middleware_1 = require("../middleware/upload.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const upload_controller_1 = require("../controllers/upload.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"));
router.post("/", upload_middleware_1.uploadExcel.single("file"), upload_controller_1.uploadLeads);
router.post("/preview", upload_middleware_1.uploadExcel.single("file"), upload_controller_1.previewUpload);
router.get("/latest", upload_controller_1.getLatestUpload);
router.get("/history", upload_controller_1.getUploadHistory);
router.patch("/:id/source", upload_controller_1.patchUploadFileSource);
router.delete("/:id", upload_controller_1.deleteUploadFile);
exports.default = router;
