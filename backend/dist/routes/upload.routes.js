"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_middleware_1 = __importDefault(require("../middleware/upload.middleware"));
const upload_controller_1 = require("../controllers/upload.controller");
const router = express_1.default.Router();
/* ================= UPLOAD ================= */
router.post("/", upload_middleware_1.default.single("file"), upload_controller_1.uploadLeads);
/* ================= LATEST ================= */
router.get("/latest", upload_controller_1.getLatestUpload);
exports.default = router;
