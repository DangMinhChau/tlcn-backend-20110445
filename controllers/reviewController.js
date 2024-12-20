const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const isValidReview = require('../utils/checkComment');
const Review = require('./../models/reviewModel');
const factory = require('./handlerFactory');

exports.setProductUserIds = (req, res, next) => {
  // Allow nested routes
  if (!req.body.product) req.body.product = req.params.productId;
  if (!req.body.user) req.body.user = req.user._id;
  next();
};
exports.getAllReviews = factory.getAll(Review);
exports.createNewReview = factory.createOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.getReview = factory.getOne(Review);
exports.updateReview = factory.updateOne(Review);

exports.checkReviewIsValid = catchAsync(async (req, res, next) => {
  // console.log(req.body);
  const review = await Review.findOne({
    user: req.user,
    product: req.body.product,
  });
  if (review) {
    return next(new AppError('Bạn đã bình luận sản phẩm này', 400));
  }
  if (!isValidReview(req.body.comment)) {
    return next(
      new AppError(
        'Bình luận của bạn chứa từ phản cảm! Vui lòng thử lại sau',
        400
      )
    );
  }
  next();
});
