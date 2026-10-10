const express = require('express');
const router = express.Router();

const authMiddleware = require('./middlewares/auth')

const authRouter = require('./auth');
const usersRouter = require('./users');
const parkingRouter = require('./parking');
const notificationsRouter = require('./notifications');
const reportsRouter = require('./reports');
const setupRouter = require('./setup');

/* GET home page. */
router.get('/', (req, res, next) => {
  res.json({ success : 'node shop api'});
});

/* GET home page. */
router.get('/user', authMiddleware , (req, res, next) => {
  res.json({ status : 'success' , user : { ...req.user ,   permissions : [
    'manage_products',
    'manage_users',
    'edit_product',
    'delete_product'
  ]} });
});

router.use('/auth', authRouter);
router.use('/users', authMiddleware, usersRouter);
router.use('/parking', authMiddleware, parkingRouter);
router.use('/notifications', authMiddleware, notificationsRouter);
router.use('/reports', authMiddleware, reportsRouter);
router.use('/setup', setupRouter);

module.exports = router;