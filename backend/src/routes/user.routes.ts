import express from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { maskCnic } from "../config/security";
import { userBrowserMap } from "../utils/sessions";
import { getCache, setCache, invalidateCache } from "../utils/cache";
import upload from "../middleware/upload.middleware";
import cloudinary from "../config/cloudinary";
import { Readable } from "stream";

import {
  updateUser,
  deleteUser,
} from "../controllers/user.controller";

const router = express.Router();

router.use(verifyToken);

/* ================= GET ALL USERS — admin + csr (chat) ================= */
router.get("/", allowRoles("admin", "csr"), async (req: AuthRequest, res) => {
  try {
    const viewerRole = req.user!.role;
    const CACHE_KEY = `users:list:${viewerRole}`;

    let users = getCache<Array<Record<string, unknown>>>(CACHE_KEY);
    if (!users) {
      users = await prisma.user.findMany({
        select: {
          id:         true,
          name:       true,
          email:      true,
          role:       true,
          csrCode:    true,
          cnic:       true,
          profilePic: true,
          isActive:   true,
          isOnline:   true,
          lastActive: true,
          createdAt:  true,
        },
        orderBy: { createdAt: "asc" },
      }) as Array<Record<string, unknown>>;
      setCache(CACHE_KEY, users, 15_000);
    }

    const withBrowser = users.map(u => ({
      ...u,
      cnic:       maskCnic(u.cnic as string | null, viewerRole),
      browser:    userBrowserMap.get(u.id as string)?.browser    ?? null,
      tabId:      userBrowserMap.get(u.id as string)?.tabId      ?? null,
      openedAt:   userBrowserMap.get(u.id as string)?.openedAt   ?? null,
      tabVisible: userBrowserMap.get(u.id as string)?.tabVisible ?? null,
      hiddenAt:   userBrowserMap.get(u.id as string)?.hiddenAt   ?? null,
    }));

    return res.json(withBrowser);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

/* ================= UPLOAD PROFILE PIC — authenticated users ================= */
router.post("/upload-pic", upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "crm_profile_pics", transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }] },
        (err, result) => { if (err || !result) return reject(err); resolve(result.secure_url); }
      );
      Readable.from(req.file!.buffer).pipe(stream);
    });
    return res.json({ url });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Upload failed" });
  }
});

router.put("/:id", allowRoles("admin"), updateUser);
router.delete("/:id", allowRoles("admin"), deleteUser);

export default router;
