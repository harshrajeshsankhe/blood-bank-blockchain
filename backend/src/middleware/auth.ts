import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthUser, Role } from "../types";

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(header.slice(7), secret()) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function roles(...allowed: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
