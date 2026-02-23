import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

const JWT_SECRET = 'dev-secret-change-in-production';

function userToken(userId = 'user-1') {
  return jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Grading Submission Routes', () => {
  let ctx: TestContext;
  let token: string;
  let cardId: string;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Create a real user so foreign key constraints are satisfied
    const user = await ctx.db.createUser({ username: 'testuser', email: 'test@example.com', password: 'password123' });
    userId = user.id;
    token = userToken(userId);

    const card = await ctx.db.createCard({
      userId,
      player: 'Mike Trout',
      team: 'Angels',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      cardNumber: '1',
      condition: 'Near Mint',
      purchasePrice: 50,
      purchaseDate: '2023-01-01',
      currentValue: 100,
      images: [],
      notes: '',
    });
    cardId = card.id;
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  // Helper to create a submission
  const createSubmission = async (overrides: Record<string, unknown> = {}) => {
    return request(ctx.app)
      .post('/api/grading-submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cardId,
        gradingCompany: 'PSA',
        submissionNumber: 'PSA-12345',
        tier: 'Regular',
        cost: 30,
        declaredValue: 100,
        submittedAt: '2024-01-15T00:00:00.000Z',
        ...overrides,
      });
  };

  // ─── GET /api/grading-submissions ──────────────────────────────────────────

  describe('GET /api/grading-submissions', () => {
    it('returns 200 with submissions list', async () => {
      await createSubmission();
      const res = await request(ctx.app)
        .get('/api/grading-submissions')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      const res = await request(ctx.app)
        .get('/api/grading-submissions?status=Submitted')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      res.body.forEach((s: any) => expect(s.status).toBe('Submitted'));
    });

    it('filters by cardId', async () => {
      const res = await request(ctx.app)
        .get(`/api/grading-submissions?cardId=${cardId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      res.body.forEach((s: any) => expect(s.cardId).toBe(cardId));
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app).get('/api/grading-submissions');
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid status filter', async () => {
      const res = await request(ctx.app)
        .get('/api/grading-submissions?status=InvalidStatus')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/grading-submissions/stats ────────────────────────────────────

  describe('GET /api/grading-submissions/stats', () => {
    it('returns correct aggregates', async () => {
      const res = await request(ctx.app)
        .get('/api/grading-submissions/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalSubmissions');
      expect(res.body).toHaveProperty('pending');
      expect(res.body).toHaveProperty('complete');
      expect(res.body).toHaveProperty('totalCost');
      expect(res.body).toHaveProperty('avgTurnaroundDays');
      expect(res.body).toHaveProperty('avgGrade');
      expect(res.body.totalSubmissions).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── GET /api/grading-submissions/:id ──────────────────────────────────────

  describe('GET /api/grading-submissions/:id', () => {
    it('returns 200 with submission', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-GET-1' });
      const res = await request(ctx.app)
        .get(`/api/grading-submissions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.submissionNumber).toBe('PSA-GET-1');
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(ctx.app)
        .get('/api/grading-submissions/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/grading-submissions ─────────────────────────────────────────

  describe('POST /api/grading-submissions', () => {
    it('returns 201 with valid data', async () => {
      const res = await createSubmission({ submissionNumber: 'PSA-CREATE-1' });
      expect(res.status).toBe(201);
      expect(res.body.gradingCompany).toBe('PSA');
      expect(res.body.submissionNumber).toBe('PSA-CREATE-1');
      expect(res.body.status).toBe('Submitted');
      expect(res.body.cost).toBe(30);
      expect(res.body.userId).toBe(userId);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request(ctx.app)
        .post('/api/grading-submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({ cardId });
      expect(res.status).toBe(400);
    });

    it('returns 404 for invalid cardId', async () => {
      const res = await createSubmission({ cardId: 'nonexistent-card' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Card not found');
    });

    it('returns 400 for invalid gradingCompany', async () => {
      const res = await createSubmission({ gradingCompany: 'INVALID' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid gradingCompany');
    });

    it('returns 400 for invalid tier', async () => {
      const res = await createSubmission({ tier: 'INVALID' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid tier');
    });
  });

  // ─── PUT /api/grading-submissions/:id ──────────────────────────────────────

  describe('PUT /api/grading-submissions/:id', () => {
    it('returns 200 on update', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-UPD-1' });
      const res = await request(ctx.app)
        .put(`/api/grading-submissions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated notes', cost: 50 });
      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Updated notes');
      expect(res.body.cost).toBe(50);
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(ctx.app)
        .put('/api/grading-submissions/nonexistent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'test' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when no valid fields provided', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-UPD-2' });
      const res = await request(ctx.app)
        .put(`/api/grading-submissions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ invalidField: 'test' });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/grading-submissions/:id/status ─────────────────────────────

  describe('POST /api/grading-submissions/:id/status', () => {
    it('advances status correctly: Submitted -> Received', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-STATUS-1' });
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Received' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Received');
      expect(res.body.receivedAt).not.toBeNull();
    });

    it('advances through multiple statuses', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-STATUS-2' });
      // Submitted -> Received
      await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Received' });
      // Received -> Grading
      await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Grading' });
      // Grading -> Shipped
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Shipped' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Shipped');
      expect(res.body.shippedAt).not.toBeNull();
      expect(res.body.gradingAt).not.toBeNull();
      expect(res.body.receivedAt).not.toBeNull();
    });

    it('rejects backward status transition', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-STATUS-3' });
      // Advance to Received
      await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Received' });
      // Try to go backward
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Submitted' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('rejects same status transition', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-STATUS-4' });
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Submitted' });
      expect(res.status).toBe(400);
    });

    it('on Complete: updates card grade/isGraded/gradingCompany', async () => {
      // Create a new card specifically for this test
      const card2 = await ctx.db.createCard({
        userId,
        player: 'Shohei Ohtani',
        team: 'Dodgers',
        year: 2024,
        brand: 'Topps',
        category: 'Baseball',
        cardNumber: '100',
        condition: 'Mint',
        purchasePrice: 20,
        purchaseDate: '2024-01-01',
        currentValue: 60,
        images: [],
        notes: '',
      });

      const created = await request(ctx.app)
        .post('/api/grading-submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cardId: card2.id,
          gradingCompany: 'BGS',
          submissionNumber: 'BGS-COMPLETE-1',
          tier: 'Express',
          cost: 75,
          submittedAt: '2024-01-01T00:00:00.000Z',
        });

      // Advance through all statuses to Complete
      for (const status of ['Received', 'Grading', 'Shipped']) {
        await request(ctx.app)
          .post(`/api/grading-submissions/${created.body.id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status });
      }

      const completeRes = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Complete', grade: '9.5' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.status).toBe('Complete');
      expect(completeRes.body.grade).toBe('9.5');
      expect(completeRes.body.completedAt).not.toBeNull();

      // Verify card was updated
      const updatedCard = await ctx.db.getCardById(card2.id);
      expect(updatedCard?.grade).toBe('9.5');
      expect(updatedCard?.isGraded).toBe(true);
      expect(updatedCard?.gradingCompany).toBe('BGS');
    });

    it('returns 400 for invalid status value', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-STATUS-5' });
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'InvalidStatus' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent submission', async () => {
      const res = await request(ctx.app)
        .post('/api/grading-submissions/nonexistent-id/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Received' });
      expect(res.status).toBe(404);
    });

    it('allows skipping statuses forward', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-SKIP-1' });
      // Jump from Submitted directly to Complete
      const res = await request(ctx.app)
        .post(`/api/grading-submissions/${created.body.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'Complete', grade: '10' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Complete');
      expect(res.body.grade).toBe('10');
    });
  });

  // ─── DELETE /api/grading-submissions/:id ───────────────────────────────────

  describe('DELETE /api/grading-submissions/:id', () => {
    it('returns 204 on successful delete', async () => {
      const created = await createSubmission({ submissionNumber: 'PSA-DEL-1' });
      const res = await request(ctx.app)
        .delete(`/api/grading-submissions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(ctx.app)
        .get(`/api/grading-submissions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await request(ctx.app)
        .delete('/api/grading-submissions/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
