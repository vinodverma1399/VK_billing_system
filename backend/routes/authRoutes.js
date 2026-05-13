const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, updateProfile, getStaff, createStaff, updateStaff, deleteStaff, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, admin, updateProfile);

router.route('/staff')
  .get(protect, admin, getStaff)
  .post(protect, admin, createStaff);

router.route('/staff/:id')
  .put(protect, admin, updateStaff)
  .delete(protect, admin, deleteStaff);

module.exports = router;
