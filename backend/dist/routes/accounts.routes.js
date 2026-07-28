"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const accounts_controller_1 = require("../controllers/accounts.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("accounts", "admin"));
router.get("/dashboard/summary", accounts_controller_1.getAccountsDashboardSummary);
router.get("/:page", accounts_controller_1.listAccountsDates);
router.get("/:page/:date", accounts_controller_1.getAccountsRecord);
router.put("/:page/:date", accounts_controller_1.saveAccountsRecord);
router.post("/:page/:date/upload", upload_middleware_1.uploadReportFile.single("file"), accounts_controller_1.uploadAccountsFile);
exports.default = router;
