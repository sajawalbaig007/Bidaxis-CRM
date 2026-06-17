import jwt from "jsonwebtoken";

export const generateToken = (id: string, role: string, tv: number, sid: string) => {
  return jwt.sign(
    { id, role, tv, sid },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};