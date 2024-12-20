const factory = require('./handlerFactory');
const Voucher = require('./../models/voucherModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.getAllVouchers = catchAsync(async (req, res, next) => {
  // Build base query with filters
  const baseQuery = Voucher.find();

  // Get query parameters
  const { page = 1, limit = 10, sort, name, isActive = true } = req.query;

  // Apply filters
  if (name) {
    baseQuery.find({
      name: { $regex: name, $options: 'i' },
    });
  }

  // Filter by active status
  if (isActive !== undefined) {
    baseQuery.find({ isActive: isActive === 'true' });
  }

  // Apply sorting
  if (sort) {
    const sortBy = sort.split(',').join(' ');
    baseQuery.sort(sortBy);
  } else {
    baseQuery.sort('-createdAt');
  }

  // Apply pagination
  const skip = (page - 1) * limit;
  baseQuery.skip(skip).limit(parseInt(limit));

  // Execute query
  const [vouchers, total] = await Promise.all([
    baseQuery,
    Voucher.countDocuments(baseQuery._conditions),
  ]);

  res.status(200).json({
    status: 'success',
    results: vouchers.length,
    pagination: {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
    data: {
      data: vouchers,
    },
  });
});

exports.getVoucherById = factory.getOne(Voucher);

exports.createNewVoucher = factory.createOne(Voucher);
exports.updateVoucher = factory.updateOne(Voucher);

// convert string to date here
exports.converStringToDate = catchAsync(async (req, res, next) => {
  if (!req.body.startDate || !req.body.expireDate) {
    return next(new AppError('Please provide start and expire date', 400));
  }
  req.body.startDate = new Date(req.body.startDate.replaceAll('-', '/'));
  req.body.expireDate = new Date(req.body.expireDate.replaceAll('-', '/'));

  next();
});
exports.getAllVouchersByUser = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10000;
  // execute query
  const today = new Date(Date.now());
  const features = new APIFeatures(
    Voucher.find({
      startDate: {
        $lte: today,
      },
      expireDate: {
        $gte: today,
      },
      isActive: true,
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const total = await Voucher.countDocuments();
  const docs = await features.query;

  const totalPage =
    total % limit === 0 ? total / limit : Math.round(total / limit + 0.5);

  // Send response
  res.status(200).json({
    status: 'success',
    requestAt: req.requestTime,
    result: docs.length,
    totalPage: totalPage,
    currentPage: page,
    data: { data: docs },
  });
});

exports.deleteVoucher = catchAsync(async (req, res, next) => {
  const doc = await Voucher.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({ status: 'success', data: { data: doc } });
});
