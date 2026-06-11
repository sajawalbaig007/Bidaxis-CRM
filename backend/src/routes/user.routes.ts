import express from "express";
import prisma from "../config/db";
import { userBrowserMap } from "../utils/sessions";
import { getCache, setCache } from "../utils/cache";

import {
  updateUser,
  deleteUser,
} from "../controllers/user.controller";

const router = express.Router();

/* ================= GET ALL USERS — with browser info ================= */

router.get("/", async (req, res) => {
  try {
    const CACHE_KEY = "users:list";

    /* Cache only the DB rows; browser/tab data merged fresh each request */
    let users = getCache<Array<Record<string, unknown>>>(CACHE_KEY);
    if (!users) {
      users = await prisma.user.findMany({
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
      }) as Array<Record<string, unknown>>;
      setCache(CACHE_KEY, users, 2_000);
    }

    const withBrowser = users.map(u => ({
      ...u,
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

/* ================= UPDATE USER ================= */
router.put("/:id", updateUser);

/* ================= DELETE USER ================= */
router.delete("/:id", deleteUser);

export default router;