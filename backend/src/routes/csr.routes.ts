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
  allowRoles("csr"),
  (req, res) => {

    res.json({
      success: true,
      message:
        "Welcome CSR",
    });
  }
);

export default router;