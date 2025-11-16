import express from 'express';
import { query } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { requireAuth, requireAdmin } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;
    req.session.userRole = user.role;

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    req.session.destroy((err) => {
      if (err) {
        logger.error('Logout error', { error: err.message });
        return res.status(500).json({ error: 'Logout failed' });
      }

      logger.info('User logged out', { userId });
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error: any) {
    logger.error('Logout error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    logger.error('Get user error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
