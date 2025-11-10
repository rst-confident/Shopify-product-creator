import { Request, Response, NextFunction } from 'express';
import shopify from '../shopify/config';
import { query } from '../db';

export interface AuthRequest extends Request {
  shop?: string;
  storeId?: number;
  accessToken?: string;
}

export const verifyRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized - No session' });
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'Unauthorized - Invalid session' });
    }

    req.shop = session.shop;
    req.accessToken = session.accessToken;

    // Get or create store record
    const storeResult = await query(
      'SELECT id FROM stores WHERE shopify_domain = $1',
      [session.shop]
    );

    if (storeResult.rows.length > 0) {
      req.storeId = storeResult.rows[0].id;
    } else {
      // Create store record if it doesn't exist
      const newStore = await query(
        `INSERT INTO stores (shopify_domain, shopify_access_token)
         VALUES ($1, $2) RETURNING id`,
        [session.shop, session.accessToken]
      );
      req.storeId = newStore.rows[0].id;
    }

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};
