"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportUpload_controller_1 = require("../controllers/reportUpload.controller");
const upload_middleware_1 = __importDefault(require("../middleware/upload.middleware"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* UPLOAD REPORT */
router.post("/", auth_middleware_1.verifyToken, upload_middleware_1.default.single("file"), reportUpload_controller_1.uploadReport);
/* DELETE REPORT */
router.delete("/:id", auth_middleware_1.verifyToken, reportUpload_controller_1.deleteReport);
exports.default = router;
