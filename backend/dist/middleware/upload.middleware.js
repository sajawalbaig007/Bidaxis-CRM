"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadReportFile = exports.uploadExcel = void 0;
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXCEL_TYPES = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
]);
function imageFilter(_req, file, cb) {
    if (IMAGE_TYPES.has(file.mimetype))
        cb(null, true);
    else
        cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed."));
}
function excelFilter(_req, file, cb) {
    const name = file.originalname?.toLowerCase() ?? "";
    const okType = EXCEL_TYPES.has(file.mimetype);
    const okExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
    if (okType || okExt)
        cb(null, true);
    else
        cb(new Error("Only Excel (.xlsx, .xls) or CSV files are allowed."));
}
const uploadImage = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: imageFilter,
});
const uploadExcel = (0, multer_1.default)({
    storage,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: excelFilter,
});
exports.uploadExcel = uploadExcel;
const REPORT_TYPES = new Set([
    "application/pdf",
    "application/json",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
]);
function reportFilter(_req, file, cb) {
    const name = file.originalname?.toLowerCase() ?? "";
    const okExt = [".pdf", ".json", ".csv", ".xlsx", ".xls", ".txt"].some(ext => name.endsWith(ext));
    if (REPORT_TYPES.has(file.mimetype) || okExt)
        cb(null, true);
    else
        cb(new Error("Invalid report file type."));
}
const uploadReportFile = (0, multer_1.default)({
    storage,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: reportFilter,
});
exports.uploadReportFile = uploadReportFile;
exports.default = uploadImage;
