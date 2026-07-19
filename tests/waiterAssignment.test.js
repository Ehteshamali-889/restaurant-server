const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('./setup');

const User = require('../models/User');
const Table = require('../models/Table');
const Branch = require('../models/Branch');
const jwt = require('jsonwebtoken');

let app;
let adminToken;
let waiterUser;
let table;
let branch;

beforeAll(async () => {
  await connect();

  app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/tables', require('../routes/tables'));

  branch = await Branch.create({
    name: 'Test Branch',
    address: '123 Test St',
    phone: '+237000000000',
    currency: 'FCFA',
  });

  const admin = await User.create({
    username: 'testadmin',
    password: 'admin123',
    fullName: 'Test Admin',
    role: 'admin',
    branch: branch._id,
  });

  waiterUser = await User.create({
    username: 'testwaiter',
    password: 'waiter123',
    fullName: 'Test Waiter',
    role: 'waiter',
    branch: branch._id,
  });

  const waiter2 = await User.create({
    username: 'testwaiter2',
    password: 'waiter123',
    fullName: 'Test Waiter 2',
    role: 'waiter',
    branch: branch._id,
  });

  adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

  table = await Table.create({
    number: 1,
    capacity: 4,
    section: 'indoor',
    branch: branch._id,
  });
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();

  branch = await Branch.create({
    name: 'Test Branch',
    address: '123 Test St',
    phone: '+237000000000',
    currency: 'FCFA',
  });

  const admin = await User.create({
    username: 'testadmin',
    password: 'admin123',
    fullName: 'Test Admin',
    role: 'admin',
    branch: branch._id,
  });

  waiterUser = await User.create({
    username: 'testwaiter',
    password: 'waiter123',
    fullName: 'Test Waiter',
    role: 'waiter',
    branch: branch._id,
  });

  await User.create({
    username: 'testwaiter2',
    password: 'waiter123',
    fullName: 'Test Waiter 2',
    role: 'waiter',
    branch: branch._id,
  });

  adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

  table = await Table.create({
    number: 1,
    capacity: 4,
    section: 'indoor',
    branch: branch._id,
  });
});

describe('GET /api/auth/users', () => {
  it('should return only waiters when role=waiter', async () => {
    const res = await request(app)
      .get('/api/auth/users?role=waiter')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((u) => {
      expect(u.role).toBe('waiter');
    });
  });

  it('should return all users when no role filter', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('should not return passwords', async () => {
    const res = await request(app)
      .get('/api/auth/users?role=waiter')
      .set('Authorization', `Bearer ${adminToken}`);

    res.body.data.forEach((u) => {
      expect(u.password).toBeUndefined();
    });
  });

  it('should fail without auth token', async () => {
    const res = await request(app)
      .get('/api/auth/users?role=waiter');

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/tables/:id/assign', () => {
  it('should assign a waiter to a table', async () => {
    const res = await request(app)
      .put(`/api/tables/${table._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ waiterId: waiterUser._id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedWaiter).toBeDefined();
    expect(res.body.data.assignedWaiter.fullName).toBe('Test Waiter');
  });

  it('should update assigned waiter when reassigned', async () => {
    await request(app)
      .put(`/api/tables/${table._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ waiterId: waiterUser._id });

    const waiter2 = await User.findOne({ username: 'testwaiter2' });
    const res = await request(app)
      .put(`/api/tables/${table._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ waiterId: waiter2._id });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedWaiter.fullName).toBe('Test Waiter 2');
  });

  it('should fail without auth token', async () => {
    const res = await request(app)
      .put(`/api/tables/${table._id}/assign`)
      .send({ waiterId: waiterUser._id });

    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent table', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/tables/${fakeId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ waiterId: waiterUser._id });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tables/:id (populated waiter)', () => {
  it('should return table with populated assignedWaiter', async () => {
    await request(app)
      .put(`/api/tables/${table._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ waiterId: waiterUser._id });

    const res = await request(app)
      .get(`/api/tables/${table._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assignedWaiter).toBeDefined();
    expect(res.body.data.assignedWaiter.fullName).toBe('Test Waiter');
    expect(res.body.data.assignedWaiter.username).toBe('testwaiter');
  });
});
