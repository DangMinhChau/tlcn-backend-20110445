const express = require('express');
const authController = require('./../controllers/authController');
const voucherController = require('./../controllers/voucherController');

const router = express.Router();

router
  .route('/')
  .get(voucherController.getAllVouchersByUser)
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    voucherController.converStringToDate,
    voucherController.createNewVoucher
  );

router
  .route('/admin')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    voucherController.getAllVouchers
  );
router
  .route('/:id')
  .get(voucherController.getVoucherById)
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    voucherController.converStringToDate,
    voucherController.updateVoucher
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    voucherController.deleteVoucher
  );
module.exports = router;
