"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const csr_routes_1 = __importDefault(require("./routes/csr.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const reportUpload_routes_1 = __importDefault(require("./routes/reportUpload.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const allowedOrigins = [
    "http://localhost:3000",
    process.env.FRONTEND_URL,
].filter(Boolean);
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    maxAge: 86400,
}));
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "1mb" }));
app.use((0, cookie_parser_1.default)());
app.use("/api", rateLimit_middleware_1.apiLimiter);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/csr", csr_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/uploads", upload_routes_1.default);
app.use("/api/reports", report_routes_1.default);
app.use("/api/report-uploads", reportUpload_routes_1.default);
app.use("/api/chat", chat_routes_1.default);
app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ success: false, message: "Invalid JSON body." });
    }
    if (err.message?.includes("file") || err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: err.message || "File upload error." });
    }
    next(err);
});
exports.default = app;
