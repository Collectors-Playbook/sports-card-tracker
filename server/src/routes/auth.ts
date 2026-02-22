import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, User } from '../types';
import { authenticateToken } from '../middleware/auth';
import { loadConfig } from '../config';

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _, ...sanitized } = user;
  return sanitized;
}

export function createAuthRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        res.status(400).json({ error: 'Missing required fields: username, email, password' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const existingEmail = await db.getUserByEmail(email);
      if (existingEmail) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      const existingUsername = await db.getUserByUsername(username);
      if (existingUsername) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      const user = await db.createUser({ username, email, password });
      const config = loadConfig();
      const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });

      auditService.log(req, { action: 'user.register', entity: 'user', entityId: user.id });
      res.status(201).json({ user: sanitizeUser(user), token });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Missing required fields: email, password' });
        return;
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        auditService.log(req, { action: 'user.login_failed', entity: 'user', details: { email } });
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        auditService.log(req, { action: 'user.login_failed', entity: 'user', details: { email } });
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const config = loadConfig();
      const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });

      auditService.log(req, { action: 'user.login', entity: 'user', entityId: user.id });
      res.json({ user: sanitizeUser(user), token });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ error: 'Failed to log in' });
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await db.getUserById(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // PUT /api/auth/profile
  router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { username, email, currentPassword, newPassword, profilePhoto } = req.body;

      const existing = await db.getUserById(userId);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check uniqueness if changing username
      if (username && username !== existing.username) {
        const dupe = await db.getUserByUsername(username);
        if (dupe) {
          res.status(409).json({ error: 'Username already taken' });
          return;
        }
      }

      // Check uniqueness if changing email
      if (email && email !== existing.email) {
        const dupe = await db.getUserByEmail(email);
        if (dupe) {
          res.status(409).json({ error: 'Email already in use' });
          return;
        }
      }

      // Handle password change
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({ error: 'Current password required to set new password' });
          return;
        }
        const validPassword = await bcrypt.compare(currentPassword, existing.passwordHash);
        if (!validPassword) {
          res.status(401).json({ error: 'Current password is incorrect' });
          return;
        }
        if (newPassword.length < 6) {
          res.status(400).json({ error: 'New password must be at least 6 characters' });
          return;
        }
        const newHash = await bcrypt.hash(newPassword, 10);
        await db.updateUserPassword(userId, newHash);
        auditService.log(req, { action: 'user.password_change', entity: 'user', entityId: userId });
      }

      // Update username/email/profilePhoto
      const updates: Partial<Pick<User, 'username' | 'email' | 'profilePhoto'>> = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;

      const updated = await db.updateUser(userId, updates);
      if (!updated) {
        res.status(500).json({ error: 'Failed to update profile' });
        return;
      }

      auditService.log(req, { action: 'user.profile_update', entity: 'user', entityId: userId, details: { fields: Object.keys(updates) } });
      res.json(sanitizeUser(updated));
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  return router;
}
