const { cloudinary, uploadCloud } = require('../configs/cloudinary');

// const multer = require('multer');

const User = require('./../models/userModel');

const AppError = require('../utils/appError');
const catchAsync = require('./../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

exports.uploadUserPhoto = uploadCloud.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  req.file.filename = req.file.path;
  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates', 400));
  }

  const filteredBody = filterObj(req.body, 'firstName', 'lastName', 'email');
  if (req.file) {
    // Delete old image from cloudinary if exists
    if (req.user.photo && req.user.photo.includes('cloudinary')) {
      const publicId = req.user.photo.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`clothes-shop/${publicId}`);
    }
    filteredBody.photo = req.file.filename;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.getMe = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

exports.deleteUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { isLocked: true });
  res.status(204).json({
    status: 'success',
    data: {
      user: null,
    },
  });
});
exports.updateUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.params.id, { isLocked: false });
  res.status(204).json({
    status: 'success',
    data: {
      user: null,
    },
  });
});

exports.getUserByEmail = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).lean();
  if (!user) {
    return next(new AppError('No document found with that ID', 404));
  }
  res.status(200).json({ status: 'success', data: { data: user } });
});
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10000;
  // execute query
  const features = new APIFeatures(User.find().lean(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const total = await User.countDocuments();
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
exports.getUser = catchAsync(async (req, res, next) => {
  const query = User.findById(req.params.id).lean();
  const user = await query;
  if (!user) {
    return next(new AppError('No document found with that ID', 404));
  }
  res.status(200).json({ status: 'success', data: { data: user } });
});

exports.createAllAdress = catchAsync(async (req, res, next) => {
  const { addresses, _id } = req.user;
  addresses.push(req.body);
  const updatedUser = await User.findByIdAndUpdate(
    { _id: _id },
    {
      addresses: addresses,
    }
  );
  res.status(201).json({ status: 'success', data: updatedUser });
});
exports.deleteAddress = catchAsync(async (req, res, next) => {
  const { addressId } = req.params;
  const { addresses, _id } = req.user;

  const updatedAdresses = addresses.filter(
    (address) => address._id.toString() !== addressId
  );
  const updatedUser = await User.findByIdAndUpdate(
    { _id: _id },
    {
      addresses: updatedAdresses,
    }
  );
  res.status(204).json({ status: 'success', data: updatedUser });
});

exports.updatedAdresses = catchAsync(async (req, res, next) => {
  const { addressId } = req.params;
  const { addresses, _id } = req.user;
  const updatedAdresses = addresses.map((item) => {
    if (item._id.toString() === addressId) {
      item.fullName = req.body.fullName || item.fullName;
      item.address = req.body.address || item.address;
      item.phoneNo = req.body.phoneNo || item.phoneNo;
      item.city = req.body.city || item.city;
      item.district = req.body.district || item.district;
      item.ward = req.body.ward || item.ward;
    }
    return item;
  });
  const updatedUser = await User.findByIdAndUpdate(
    { _id: _id },
    {
      addresses: updatedAdresses,
    }
  );
  res.status(201).json({ status: 'success', data: updatedUser });
  next();
});
