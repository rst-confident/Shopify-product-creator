import { Request, Response, NextFunction } from 'express';

// Extend Express Session to include user data
declare module 'express-session' {
  interface SessionData {
    userId: number;
    userEmail: string;
    userName: string | null;
    userRole: string;
  }
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string | null;
        role: string;
      };
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session?.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Middleware to attach user data to request (if authenticated)
 */
export function attachUser(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    req.user = {
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName || null,
      role: req.session.userRole,
    };
  }
  next();
}
