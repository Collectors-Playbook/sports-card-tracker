describe('UserService', () => {
  // Use isolateModules so each describe block gets a fresh singleton
  const loadService = () => {
    let mod: typeof import('../../services/userService');
    jest.isolateModules(() => {
      mod = require('../../services/userService');
    });
    return mod!.userService;
  };

  // ---- init ----
  describe('initialization', () => {
    it('creates default admin when localStorage is empty', () => {
      const svc = loadService();
      const users = svc.getAllUsers();
      expect(users.length).toBeGreaterThanOrEqual(1);
      expect(users.find(u => u.email === 'admin@sportscard.local')).toBeTruthy();
    });

    it('loads users from localStorage when present', () => {
      const stored = [{
        id: 'u1', username: 'alice', email: 'a@b.com', role: 'user', isActive: true,
        createdAt: '2024-01-01', updatedAt: '2024-01-01', password: 'pass'
      }];
      localStorage.setItem('sports-card-tracker-users', JSON.stringify(stored));
      const svc = loadService();
      const users = svc.getAllUsers();
      expect(users.some(u => u.email === 'a@b.com')).toBe(true);
    });

    it('falls back to default admin on corrupt localStorage', () => {
      localStorage.setItem('sports-card-tracker-users', 'INVALID_JSON');
      const svc = loadService();
      const users = svc.getAllUsers();
      expect(users.some(u => u.email === 'admin@sportscard.local')).toBe(true);
    });
  });

  // ---- CRUD ----
  describe('CRUD operations', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('creates a new user with generated id', () => {
      const user = svc.createUser({ username: 'bob', email: 'bob@test.com', password: 'p', role: 'user', isActive: true });
      expect(user.id).toBeTruthy();
      expect(user.email).toBe('bob@test.com');
      expect(user.password).toBeUndefined(); // password not exposed
    });

    it('gets user by id', () => {
      const created = svc.createUser({ username: 'c', email: 'c@test.com', password: 'p', role: 'user', isActive: true });
      const found = svc.getUserById(created.id);
      expect(found).toBeTruthy();
      expect(found!.email).toBe('c@test.com');
      expect(found!.password).toBeUndefined();
    });

    it('returns null for non-existent user id', () => {
      expect(svc.getUserById('nonexistent')).toBeNull();
    });

    it('updates user fields', () => {
      const created = svc.createUser({ username: 'd', email: 'd@test.com', password: 'p', role: 'user', isActive: true });
      const updated = svc.updateUser(created.id, { username: 'dNew' });
      expect(updated!.username).toBe('dNew');
    });

    it('prevents id change on update', () => {
      const created = svc.createUser({ username: 'e', email: 'e@test.com', password: 'p', role: 'user', isActive: true });
      const updated = svc.updateUser(created.id, { id: 'hacked-id' } as any);
      expect(updated!.id).toBe(created.id);
    });

    it('preserves createdAt on update', () => {
      const created = svc.createUser({ username: 'f', email: 'f@test.com', password: 'p', role: 'user', isActive: true });
      const updated = svc.updateUser(created.id, { username: 'fNew' });
      expect(updated!.createdAt).toEqual(created.createdAt);
    });

    it('returns null when updating non-existent user', () => {
      expect(svc.updateUser('fake', { username: 'x' })).toBeNull();
    });

    it('deletes a non-admin user', () => {
      const user = svc.createUser({ username: 'g', email: 'g@test.com', password: 'p', role: 'user', isActive: true });
      expect(svc.deleteUser(user.id)).toBe(true);
      expect(svc.getUserById(user.id)).toBeNull();
    });
  });

  // ---- deleteUser admin protection ----
  describe('deleteUser admin protection', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('throws when deleting the last active admin', () => {
      const admin = svc.getAllUsers().find(u => u.role === 'admin');
      expect(() => svc.deleteUser(admin!.id)).toThrow('Cannot delete the last active admin');
    });

    it('allows deleting an admin if another admin exists', () => {
      const newAdmin = svc.createUser({ username: 'admin2', email: 'a2@test.com', password: 'p', role: 'admin', isActive: true });
      // Now there are 2 admins - deleting the default one should work
      const defaultAdmin = svc.getAllUsers().find(u => u.email === 'admin@sportscard.local');
      expect(svc.deleteUser(defaultAdmin!.id)).toBe(true);
    });

    it('returns false when deleting non-existent user', () => {
      expect(svc.deleteUser('fake-id')).toBe(false);
    });
  });

  // ---- toggleStatus ----
  describe('toggleUserStatus', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('toggles active status', () => {
      const user = svc.createUser({ username: 'h', email: 'h@test.com', password: 'p', role: 'user', isActive: true });
      const toggled = svc.toggleUserStatus(user.id);
      expect(toggled!.isActive).toBe(false);
    });

    it('throws when disabling last active admin', () => {
      const admin = svc.getAllUsers().find(u => u.role === 'admin');
      expect(() => svc.toggleUserStatus(admin!.id)).toThrow('Cannot disable the last active admin');
    });
  });

  // ---- changeRole ----
  describe('changeUserRole', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('changes role from user to admin', () => {
      const user = svc.createUser({ username: 'i', email: 'i@test.com', password: 'p', role: 'user', isActive: true });
      const changed = svc.changeUserRole(user.id, 'admin');
      expect(changed!.role).toBe('admin');
    });

    it('throws when demoting the last admin', () => {
      const admin = svc.getAllUsers().find(u => u.role === 'admin');
      expect(() => svc.changeUserRole(admin!.id, 'user')).toThrow('Cannot demote the last active admin');
    });

    it('returns null for non-existent user', () => {
      expect(svc.changeUserRole('fake', 'admin')).toBeNull();
    });
  });

  // ---- authenticateUser ----
  describe('authenticateUser', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('authenticates with correct credentials', () => {
      const result = svc.authenticateUser('admin@sportscard.local', 'admin123');
      expect(result).toBeTruthy();
      expect(result!.email).toBe('admin@sportscard.local');
      expect(result!.password).toBeUndefined();
    });

    it('returns null for wrong password', () => {
      expect(svc.authenticateUser('admin@sportscard.local', 'wrong')).toBeNull();
    });

    it('returns null for non-existent email', () => {
      expect(svc.authenticateUser('nobody@test.com', 'pass')).toBeNull();
    });
  });

  // ---- getUserStatistics ----
  describe('getUserStatistics', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('counts total users', () => {
      const stats = svc.getUserStatistics();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(1);
    });

    it('separates admin and regular users', () => {
      svc.createUser({ username: 'x', email: 'x@test.com', password: 'p', role: 'user', isActive: true });
      const stats = svc.getUserStatistics();
      expect(stats.adminUsers).toBeGreaterThanOrEqual(1);
      expect(stats.regularUsers).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- resetPassword ----
  describe('resetUserPassword', () => {
    let svc: ReturnType<typeof loadService>;

    beforeEach(() => {
      svc = loadService();
    });

    it('resets password for existing user', () => {
      const admin = svc.getAllUsers().find(u => u.role === 'admin');
      expect(svc.resetUserPassword(admin!.id, 'newpass')).toBe(true);
      // Verify new password works
      expect(svc.authenticateUser('admin@sportscard.local', 'newpass')).toBeTruthy();
    });

    it('returns false for non-existent user', () => {
      expect(svc.resetUserPassword('fake', 'pass')).toBe(false);
    });
  });
});
