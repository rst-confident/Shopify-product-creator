import { Request, Response, NextFunction } from 'express';
import shopify from '../shopify/config';
import logger from '../utils/logger';

export interface SessionTokenRequest extends Request {
  shop?: string;
  sessionToken?: string;
}

/**
 * Middleware to verify session tokens from embedded app requests
 * Session tokens are sent by App Bridge in the Authorization header
 */
export const verifySessionToken = async (
  req: SessionTokenRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('No authorization header found');
      return res.status(401).json({ error: 'Unauthorized - No session token' });
    }

    // Extract the token (format: "Bearer <token>")
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      logger.warn('No token in authorization header');
      return res.status(401).json({ error: 'Unauthorized - Invalid token format' });
    }

    try {
      // Verify the session token using Shopify's built-in verification
      const payload = await shopify.session.decodeSessionToken(token);

      // Extract shop from the payload
      req.shop = payload.dest.replace('https://', '');
      req.sessionToken = token;

      logger.info('Session token verified', { shop: req.shop });

      next();
    } catch (decodeError: any) {
      logger.error('Session token decode error', { error: decodeError.message });
      return res.status(401).json({ error: 'Unauthorized - Invalid session token' });
    }
  } catch (error: any) {
    logger.error('Session token verification error', { error: error.message });
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Optional middleware that tries session token first, falls back to cookie session
 * Use this for endpoints that might be accessed from both embedded and non-embedded contexts
 */
export const verifyFlexibleAuth = async (
  req: SessionTokenRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  // If there's an authorization header, use session token auth
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifySessionToken(req, res, next);
  }

  // Otherwise, fall back to cookie-based session (for OAuth flow)
  next();
};
