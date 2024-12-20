const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/login', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.get('/verify/:token', authController.verifyEmail);

router.use(authController.protect);

router.get('/me-test', authController.isLoggedIn);
router.patch('/change-password', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);

router
  .route('/addresses/:addressId')
  .post(userController.createAllAdress)
  .patch(userController.updatedAdresses)
  .delete(userController.deleteAddress);

router.patch(
  '/update-me',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);

router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.getUserByEmail);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);
// trc trạng thái thanh toán COD :))) để cho user comment trước

module.exports = router;
