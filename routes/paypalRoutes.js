const express = require('express');
const paypalController = require('../controllers/paypalController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);
router.post('/create-paypal-order', paypalController.createPayPalOrder);
router.post('/capture-paypal-payment', paypalController.capturePayment);
module.exports = router;
