import express from "express";

import cors from "cors";

import dotenv from "dotenv";

import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";

import adminRoutes from "./routes/admin.routes";

import csrRoutes from "./routes/csr.routes";

import uploadRoutes from "./routes/upload.routes";

import userRoutes from "./routes/user.routes";

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
export default app;