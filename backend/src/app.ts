import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import csrRoutes from "./routes/csr.routes";
import uploadRoutes from "./routes/upload.routes";
import userRoutes from "./routes/user.routes";
import reportRoutes from "./routes/report.routes";
import reportUploadRoutes from "./routes/reportUpload.routes";
import chatRoutes from "./routes/chat.routes";
import { apiLimiter } from "./middleware/rateLimit.middleware";

import { validateEnv } from "./config/env";

dotenv.config();
validateEnv();

const app = express();
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = [
  "http://localhost:3000",
  
  "https://crm-blond-theta.vercel.app",
  "https://dashboard.bemsolutions.io",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://challenges.cloudflare.com"],
      frameSrc:   ["'self'", "https://challenges.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL ?? ""].filter(Boolean),
    },
  } : false,
  hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
}));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    maxAge: 86_400,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/csr", csrRoutes);
app.use("/api/users", userRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/report-uploads", reportUploadRoutes);
app.use("/api/chat", chatRoutes);

app.use((
  err: Error & { code?: string },
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON body." });
  }
  if (err.message?.includes("file") || err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: err.message || "File upload error." });
  }
  next(err);
});

export default app;
