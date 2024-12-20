const express = require('express');
const authController = require('./../controllers/authController');

const orderController = require('./../controllers/orderController');

const router = express.Router();

router.use(authController.protect);
router
  .route('/order-stats')
  .get(authController.restrictTo('admin'), orderController.getOrderStats);

router
  .route('/')
  .get(authController.restrictTo('admin'), orderController.getAllOrders)
  .post(orderController.getMe, orderController.createNewOrder);
// UserId get from logged user
router.route('/user').get(orderController.getAllOrdersByUser);
//Khi thanh toán ở trang orderDetail thì xài cái này hoặc thanh toán xong rồi mới tạo
router.route('/payment/:id').patch(orderController.updateOrder);
// viết cập nhật done cho order riêng
router
  .route('/:id')
  .get(orderController.getOrder)
  .patch(
    authController.restrictTo('admin'),
    orderController.acceptOrder,
    orderController.updateOrder
  )
  .delete(orderController.deleteOrder, orderController.updateOrder);

router
  .route('/admin/:id')
  .patch(
    authController.restrictTo('admin'),
    orderController.completeOrder,
    orderController.updateOrder
  );

module.exports = router;
