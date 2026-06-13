import express from "express";

import cors from "cors";

import dotenv from "dotenv";

import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";

import adminRoutes from "./routes/admin.routes";

import csrRoutes from "./routes/csr.routes";

import uploadRoutes from "./routes/upload.routes";

import userRoutes from "./routes/user.routes";

import reportRoutes from "./routes/report.routes";

import reportUploadRoutes from "./routes/reportUpload.routes";
import chatRoutes from "./routes/chat.routes";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

/* =========================================
   ROUTES
========================================= */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/csr",
  csrRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/uploads",
  uploadRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/report-uploads",
  reportUploadRoutes
);

app.use(
  "/api/chat",
  chatRoutes
);

export default app;