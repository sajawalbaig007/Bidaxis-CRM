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

dotenv.config();

const app = express();

app.use(
  cors({
    origin:
      "http://localhost:3000",

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

export default app;