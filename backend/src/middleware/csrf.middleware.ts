import { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/captcha-config",
]);

/**
 * Double-submit CSRF protection:
 * - frontend sets readable `csrf_token` cookie
 * - mutating requests send same value in `x-csrf-token`
 */
export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.header("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      code: "CSRF_INVALID",
      message: "Security check failed. Refresh and try again.",
    });
  }
  return next();
}

