const request = require('supertest');
const app = require('./server');

describe('Frontend Service', () => {
  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('frontend');
  });

  test('GET /api/config should return backend URL config', async () => {
    const response = await request(app).get('/api/config');
    expect(response.status).toBe(200);
    expect(response.body.backendUrl).toBeDefined();
  });

  test('GET / should return HTML', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
  });
});
