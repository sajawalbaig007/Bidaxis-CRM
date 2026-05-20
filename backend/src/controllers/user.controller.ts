import { Request, Response } from "express";

import prisma from "../config/db";

export const getUsers =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const users =
        await prisma.user.findMany();

      res.json(users);

    } catch {

      res.status(500).json({
        message:
          "Server error",
      });
    }
};

export const updateUser =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const id =
        req.params.id as string;

      const {
        name,
        email,
        role,
      } = req.body;

      const user =
        await prisma.user.update({
          where: { id },

          data: {
            name,
            email,
            role,
          },
        });

      res.json(user);

    } catch {

      res.status(500).json({
        message:
          "Update failed",
      });
    }
};

export const deleteUser =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const id =
        req.params.id as string;

      await prisma.user.delete({
        where: { id },
      });

      res.json({
        message:
          "User deleted",
      });

    } catch {

      res.status(500).json({
        message:
          "Delete failed",
      });
    }
};