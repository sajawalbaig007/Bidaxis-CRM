import { Request, Response } from "express";
import prisma from "../config/db";
import { invalidateCache } from "../utils/cache";

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

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, email, role, isActive, csrCode } = req.body;

    const data: Record<string, unknown> = {};
    if (name     !== undefined) data.name     = name;
    if (email    !== undefined) data.email    = email;
    if (role     !== undefined) data.role     = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (csrCode  !== undefined) data.csrCode  = csrCode || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await prisma.user.update({
      where:  { id },
      data,
      select: { id: true, name: true, email: true, role: true, csrCode: true, isActive: true },
    });
    invalidateCache("users:list", "admin:csrs");
    return res.json(user);
  } catch {
    return res.status(500).json({ message: "Update failed" });
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

      await prisma.user.delete({ where: { id } });
      invalidateCache("users:list", "admin:csrs");
      res.json({ message: "User deleted" });

    } catch {

      res.status(500).json({
        message:
          "Delete failed",
      });
    }
};