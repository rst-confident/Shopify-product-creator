import express from 'express';
import shopify from '../shopify/config';
import logger from '../utils/logger';

const router = express.Router();

// OAuth callback - handles the redirect after merchant authorizes the app
router.get('/callback', async (req, res) => {
  try {
    logger.info('OAuth callback received', {
      shop: req.query.shop,
      host: req.query.host,
    });

    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Store session
    await shopify.config.sessionStorage.storeSession(session);

    logger.info('Session stored successfully', {
      shop: session.shop,
      isOnline: session.isOnline,
    });

    // For embedded apps, redirect to the app with shop and host parameters
    const host = req.query.host as string;
    const shop = session.shop;

    // Construct the redirect URL for embedded app
    // This will load the app inside Shopify admin iframe
    const redirectUrl = `/?shop=${shop}&host=${host}`;

    logger.info('Redirecting to app', { redirectUrl });

    res.redirect(redirectUrl);
  } catch (error: any) {
    logger.error('OAuth callback error', { error: error.message, stack: error.stack });
    res.status(500).send('OAuth failed. Please try again.');
  }
});

// Begin OAuth - initiates the OAuth flow
router.get('/', async (req, res) => {
  try {
    const shop = req.query.shop as string;

    if (!shop) {
      return res.status(400).send('Missing shop parameter');
    }

    logger.info('OAuth begin requested', { shop });

    const sanitizedShop = shopify.utils.sanitizeShop(shop, true);

    if (!sanitizedShop) {
      return res.status(400).send('Invalid shop parameter');
    }

    const authRoute = await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: '/api/auth/callback',
      isOnline: true, // Online access mode for embedded apps
      rawRequest: req,
      rawResponse: res,
    });

    logger.info('Redirecting to Shopify OAuth', { shop: sanitizedShop });

    res.redirect(authRoute);
  } catch (error: any) {
    logger.error('OAuth begin error', { error: error.message, stack: error.stack });
    res.status(500).send('OAuth initialization failed. Please try again.');
  }
});

// Verify if the current session is valid (for debugging)
router.get('/verify', async (req, res) => {
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    if (!sessionId) {
      return res.status(401).json({ valid: false, message: 'No session found' });
    }

    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session || !session.accessToken) {
      return res.status(401).json({ valid: false, message: 'Invalid session' });
    }

    res.json({
      valid: true,
      shop: session.shop,
      isOnline: session.isOnline,
      expires: session.expires,
    });
  } catch (error: any) {
    logger.error('Session verification error', { error: error.message });
    res.status(500).json({ valid: false, message: 'Verification failed' });
  }
});

export default router;
