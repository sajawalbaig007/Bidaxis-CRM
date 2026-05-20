import {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt from "jsonwebtoken";

export interface AuthRequest
  extends Request {

  user?: {
    id: string;
    role: string;
  };
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {

  try {

    /* GET TOKEN */

    const token =
      req.cookies.token;

    /* NO TOKEN */

    if (!token) {

      return res.status(401).json({
        success: false,
        message:
          "Unauthorized",
      });
    }

    /* VERIFY TOKEN */

    const decoded =
      jwt.verify(
        token,
        process.env
          .JWT_SECRET as string
      ) as {
        id: string;
        role: string;
      };

    /* SAVE USER */

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();

  } catch {

    return res.status(401).json({
      success: false,
      message:
        "Invalid token",
    });
  }
};