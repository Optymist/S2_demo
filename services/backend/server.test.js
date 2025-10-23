const request = require('supertest');
const app = require('./server');

describe('Backend API', () => {
  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('backend');
  });

  test('GET /api/message should return message', async () => {
    const response = await request(app).get('/api/message');
    expect(response.status).toBe(200);
    expect(response.body.message).toBeDefined();
  });

  test('GET /api/status should return status info', async () => {
    const response = await request(app).get('/api/status');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('running');
    expect(response.body.version).toBeDefined();
  });
});
