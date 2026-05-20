import {
  Request,
  Response,
} from "express";

import prisma from "../config/db";

import {
  comparePassword,
  hashPassword,
} from "../utils/hash";

import {
  generateToken,
} from "../utils/jwt";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

/* ================= REGISTER ================= */

export const register =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const {
        name,
        email,
        password,
        role,
      } = req.body;

      const existingUser =
        await prisma.user.findUnique({
          where: {
            email,
          },
        });

      if (existingUser) {

        return res.status(400).json({
          success: false,
          message:
            "User already exists",
        });
      }

      const hashedPassword =
        await hashPassword(
          password
        );

      const user =
        await prisma.user.create({
          data: {
            name,
            email,
            password:
              hashedPassword,
            role,
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        });

      return res.status(201).json({
        success: true,
        user,
      });

    } catch {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
      });
    }
  };

/* ================= LOGIN ================= */

export const login =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const {
        email,
        password,
      } = req.body;

      const user =
        await prisma.user.findUnique({
          where: {
            email,
          },
        });

      if (!user) {

        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      const isMatch =
        await comparePassword(
          password,
          user.password
        );

      if (!isMatch) {

        return res.status(401).json({
          success: false,
          message:
            "Invalid credentials",
        });
      }

      const token =
        generateToken(
          user.id,
          user.role
        );

      res.cookie(
        "token",
        token,
        {
          httpOnly: true,

          secure: false,

          sameSite: "lax",

          maxAge:
            7 *
            24 *
            60 *
            60 *
            1000,
        }
      );

      return res.json({
        success: true,

        role: user.role,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });

    } catch {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
      });
    }
  };

/* ================= LOGOUT ================= */

export const logout =
  async (
    req: Request,
    res: Response
  ) => {

    res.clearCookie(
      "token"
    );

    return res.json({
      success: true,
      message:
        "Logged out",
    });
  };

/* ================= GET ME ================= */

export const getMe =
  async (
    req: AuthRequest,
    res: Response
  ) => {

    try {

      if (!req.user?.id) {

        return res.status(401).json({
          success: false,
          message:
            "Unauthorized",
        });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user.id,
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

      if (!user) {

        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      return res.json({
        success: true,
        user,
      });

    } catch {

      return res.status(500).json({
        success: false,
        message:
          "Server error",
      });
    }
  };