const factory = require('./handlerFactory');

const Order = require('./../models/orderModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const sendEmail = require('../utils/email');
const User = require('../models/userModel');
const Voucher = require('../models/voucherModel');

exports.getAllOrders = catchAsync(async (req, res, next) => {
  // 1) Start with base query
  const baseQuery = Order.find()
    .populate({
      path: 'user',
      select: 'email',
    })
    .populate({
      path: 'orderItems.product',
      select: 'name sku color coverImage price',
    })
    .populate({
      path: 'voucher',
      select: 'discount',
    });

  // 2) Apply filters from query params
  const query = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach((el) => delete query[el]);

  // Filter by id
  if (query._id) {
    baseQuery.find({ _id: query._id });
  }
  // Filter by status
  if (query.orderStatus) {
    baseQuery.find({ orderStatus: query.orderStatus });
  }

  // Filter by payment method
  if (query.paymentMethod) {
    baseQuery.find({ paymentMethod: query.paymentMethod });
  }

  // 3) Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    baseQuery.sort(sortBy);
  } else {
    baseQuery.sort('-createdAt'); // Default sort by newest
  }

  // 4) Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  baseQuery.skip(skip).limit(limit);

  // Execute query
  const orders = await baseQuery;
  const total = await Order.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    pagination: {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
    data: {
      data: orders,
    },
  });
});

exports.getOrder = catchAsync(async (req, res, next) => {
  // Set populate options to get product details
  const query = Order.findById(req.params.id)
    .populate({
      path: 'orderItems.product',
      select: 'name coverImage price sku color',
    })
    .populate({
      path: 'voucher',
      select: 'discount',
    });

  const order = await query;

  if (!order) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { data: order },
  });
});

exports.getMe = (req, res, next) => {
  req.body.user = req.user._id;
  next();
};

exports.updateOrder = factory.updateOne(Order);

exports.getAllOrdersByUser = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10000;
  // execute query

  const features = new APIFeatures(
    Order.find({ user: req.user._id }).populate({ path: 'voucher' }).lean(),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const total = await Order.countDocuments();
  const orders = await features.query;

  const totalPage =
    total % limit === 0 ? total / limit : Math.round(total / limit + 0.5);

  // Send response
  res.status(200).json({
    status: 'success',
    requestAt: req.requestTime,
    result: orders.length,
    totalPage: totalPage,
    currentPage: page,
    data: { data: orders },
  });
});

// restrictTo('admin')
exports.acceptOrder = catchAsync(async (req, res, next) => {
  req.body.orderStatus = 'processing';
  next();
});

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const orderBeforUpdate = await Order.findById(req.params.id);

  if (
    orderBeforUpdate.orderStatus === 'fail' ||
    orderBeforUpdate.orderStatus === 'done'
  )
    return next(new AppError('Cannot update completed order', 400));

  if (req.user.role === 'user' && orderBeforUpdate.orderStatus !== 'new')
    return next(
      new AppError('User cannot delete order after it was processing', 400)
    );

  if (
    req.user.role === 'user' &&
    !(orderBeforUpdate.user.toString() === req.user._id.toString())
  ) {
    return next(
      new AppError('User does not have owned to cancel this order', 400)
    );
  }

  req.body.orderStatus = 'fail';
  next();
});

// restricTo('admin)
exports.completeOrder = catchAsync(async (req, res, next) => {
  const orderBeforUpdate = await Order.findById(req.params.id);
  if (
    orderBeforUpdate.orderStatus === 'fail' ||
    orderBeforUpdate.orderStatus === 'done'
  )
    return next(new AppError('Cannot update completed order', 400));
  if (
    orderBeforUpdate.paymentMethod !== 'COD' &&
    orderBeforUpdate.paymentResult.status === false
  )
    return next(new AppError('Please pay for the order through Paypal', 400));
  req.body.paymentResult = {
    status: true,
    updateTime: new Date(Date.now()),
  };

  req.body.orderStatus = 'done';
  next();
});

exports.createNewOrder = catchAsync(async (req, res, next) => {
  // Validate PayPal payment
  if (req.body.paymentMethod === 'PayPal' && !req.body.paymentResult?.id) {
    return next(new AppError('PayPal payment details required', 400));
  }

  // Create order
  const order = await Order.create({
    ...req.body,
    user: req.user._id,
    status: 'new',
  });

  res.status(201).json({
    status: 'success',
    data: { data: order },
  });
});

exports.getOrderStats = async (req, res) => {
  try {
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          numOrder: { $sum: 1 },
          sales: { $sum: '$totalPrice' },
        },
      },
      {
        $addFields: { status: '$_id' },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    const dailyOrders = await Order.aggregate([
      { $match: { orderStatus: { $eq: 'done' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          sales: { $sum: '$totalPrice' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $addFields: { date: '$_id' },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    const users = await User.aggregate([
      {
        $group: {
          _id: null,
          numUsers: { $sum: 1 },
        },
      },
    ]);
    res.status(200).json({
      status: 'success',
      data: {
        orderStats,
        dailyOrders,
        users,
      },
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};
