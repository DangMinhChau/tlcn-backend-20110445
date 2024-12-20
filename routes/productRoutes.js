const express = require('express');
const productController = require('./../controllers/productController');
const authController = require('./../controllers/authController');
const reviewRouter = require('./../routes/reviewRoutes');

const router = express.Router();
router.use('/:productId/reviews', reviewRouter);
router.route('/product-stats').get(productController.getProductStats);
router.route('/best-seller/:top').get(productController.bestSeller);

router.get('/:id', productController.getProductById);
router.get('/', productController.getAllProducts);

// Admin routes
router.use(authController.protect, authController.restrictTo('admin'));
router
  .route('/')
  .post(
    productController.uploadProductImages,
    productController.saveProductImages,
    productController.createProduct
  );

router
  .route('/:id')
  .patch(productController.uploadProductImages, productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;
