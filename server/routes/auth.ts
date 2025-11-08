import express from 'express';
import shopify from '../shopify/config';

const router = express.Router();

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;

    // Store session
    await shopify.config.sessionStorage.storeSession(session);

    // Redirect to app
    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth failed');
  }
});

// Begin OAuth
router.get('/', async (req, res) => {
  try {
    const authRoute = await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(req.query.shop as string, true)!,
      callbackPath: '/api/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    res.redirect(authRoute);
  } catch (error) {
    console.error('OAuth begin error:', error);
    res.status(500).send('OAuth initialization failed');
  }
});

export default router;
