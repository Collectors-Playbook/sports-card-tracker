import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, User } from '../types';
import { authenticateToken, requireAdmin } from '../middleware/auth';

function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _, ...sanitized } = user;
  return sanitized;
}

export function createAdminUserRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // All routes require authentication + admin role
  router.use(authenticateToken, requireAdmin);

  // GET /api/admin/users — List all users
  router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await db.getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  // GET /api/admin/users/:id — Get single user
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await db.getUserById(req.params.id);
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

  // POST /api/admin/users — Create user
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, email, password, role } = req.body;

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

      const validRole = role === 'admin' ? 'admin' : 'user';
      const user = await db.createUser({ username, email, password, role: validRole });

      auditService.log(req, {
        action: 'admin.user_create',
        entity: 'user',
        entityId: user.id,
        details: { username, email, role: validRole },
      });

      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // PUT /api/admin/users/:id — Update username/email
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, email } = req.body;
      const existing = await db.getUserById(req.params.id);
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

      const updates: Partial<Pick<User, 'username' | 'email'>> = {};
      if (username) updates.username = username;
      if (email) updates.email = email;

      const updated = await db.updateUser(req.params.id, updates);
      if (!updated) {
        res.status(500).json({ error: 'Failed to update user' });
        return;
      }

      const fields = Object.keys(updates);
      auditService.log(req, {
        action: 'admin.user_update',
        entity: 'user',
        entityId: req.params.id,
        details: { userId: req.params.id, fields },
      });

      res.json(sanitizeUser(updated));
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // POST /api/admin/users/:id/reset-password — Reset password
  router.post('/:id/reset-password', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = req.body;

      if (!password || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const existing = await db.getUserById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      await db.updateUserPassword(req.params.id, hash);

      auditService.log(req, {
        action: 'admin.user_reset_password',
        entity: 'user',
        entityId: req.params.id,
        details: { userId: req.params.id },
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // POST /api/admin/users/:id/toggle-status — Toggle isActive
  router.post('/:id/toggle-status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await db.getUserById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Block disabling last active admin
      if (existing.role === 'admin' && existing.isActive) {
        const allUsers = await db.getAllUsers();
        const activeAdmins = allUsers.filter(u => u.role === 'admin' && u.isActive);
        if (activeAdmins.length <= 1) {
          res.status(400).json({ error: 'Cannot disable the last active admin' });
          return;
        }
      }

      const newStatus = !existing.isActive;
      const updated = await db.updateUser(req.params.id, { isActive: newStatus });
      if (!updated) {
        res.status(500).json({ error: 'Failed to toggle status' });
        return;
      }

      auditService.log(req, {
        action: 'admin.user_toggle_status',
        entity: 'user',
        entityId: req.params.id,
        details: { userId: req.params.id, newStatus },
      });

      res.json(sanitizeUser(updated));
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({ error: 'Failed to toggle user status' });
    }
  });

  // POST /api/admin/users/:id/change-role — Change role
  router.post('/:id/change-role', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role } = req.body;

      if (role !== 'admin' && role !== 'user') {
        res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
        return;
      }

      const existing = await db.getUserById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Block demoting last active admin
      if (existing.role === 'admin' && role === 'user') {
        const allUsers = await db.getAllUsers();
        const activeAdmins = allUsers.filter(u => u.role === 'admin' && u.isActive);
        if (activeAdmins.length <= 1) {
          res.status(400).json({ error: 'Cannot demote the last active admin' });
          return;
        }
      }

      const oldRole = existing.role;
      const updated = await db.updateUser(req.params.id, { role });
      if (!updated) {
        res.status(500).json({ error: 'Failed to change role' });
        return;
      }

      auditService.log(req, {
        action: 'admin.user_change_role',
        entity: 'user',
        entityId: req.params.id,
        details: { userId: req.params.id, oldRole, newRole: role },
      });

      res.json(sanitizeUser(updated));
    } catch (error) {
      console.error('Error changing role:', error);
      res.status(500).json({ error: 'Failed to change role' });
    }
  });

  // DELETE /api/admin/users/:id — Delete user
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await db.getUserById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Block self-delete
      if (req.user?.userId === req.params.id) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      // Block deleting last active admin
      if (existing.role === 'admin' && existing.isActive) {
        const allUsers = await db.getAllUsers();
        const activeAdmins = allUsers.filter(u => u.role === 'admin' && u.isActive);
        if (activeAdmins.length <= 1) {
          res.status(400).json({ error: 'Cannot delete the last active admin' });
          return;
        }
      }

      const username = existing.username;
      await db.deleteUser(req.params.id);

      auditService.log(req, {
        action: 'admin.user_delete',
        entity: 'user',
        entityId: req.params.id,
        details: { userId: req.params.id, username },
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  return router;
}
