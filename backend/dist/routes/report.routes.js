"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const router = (0, express_1.Router)();
router.get("/", report_controller_1.getReports);
exports.default = router;
