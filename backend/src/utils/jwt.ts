import jwt from "jsonwebtoken";

export const generateToken = (id: string, role: string, tv: number) => {
  return jwt.sign(
    { id, role, tv },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};