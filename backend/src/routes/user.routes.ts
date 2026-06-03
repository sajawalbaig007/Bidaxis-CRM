import express from "express";
import prisma from "../config/db";
import { userBrowserMap } from "../utils/sessions";

import {
  updateUser,
  deleteUser,
} from "../controllers/user.controller";

const router = express.Router();

/* ================= GET ALL USERS — with browser info ================= */

router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id:         true,
        name:       true,
        email:      true,
        role:       true,
        isActive:   true,
        isOnline:   true,
        lastActive: true,
        createdAt:  true,
      },
      orderBy: { createdAt: "asc" },
    });

    /* Merge browser/tab info from memory map */
    const withBrowser = users.map(u => ({
      ...u,
      browser:     userBrowserMap.get(u.id)?.browser     ?? null,
      tabId:       userBrowserMap.get(u.id)?.tabId       ?? null,
      openedAt:    userBrowserMap.get(u.id)?.openedAt    ?? null,
      tabVisible:  userBrowserMap.get(u.id)?.tabVisible  ?? null,
      hiddenAt:    userBrowserMap.get(u.id)?.hiddenAt    ?? null,
    }));

    return res.json(withBrowser);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

/* ================= UPDATE USER ================= */
router.put("/:id", updateUser);

/* ================= DELETE USER ================= */
router.delete("/:id", deleteUser);

export default router;