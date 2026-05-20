import express from "express";

import {
  verifyToken,
} from "../middleware/auth.middleware";

import {
  allowRoles,
} from "../middleware/role.middleware";

const router =
  express.Router();

router.get(
  "/dashboard",
  verifyToken,
  allowRoles("admin"),
  (req, res) => {

    res.json({
      success: true,
      message:
        "Welcome Admin",
    });
  }
);

export default router;