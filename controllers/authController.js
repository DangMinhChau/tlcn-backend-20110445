const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const {
  sendVerificationEmail,
  sendResetPasswordEmail,
} = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;
  user.passwordConfirm = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};
exports.signup = catchAsync(async (req, res, next) => {
  try {
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      verificationToken,
      isVerified: false,
    });

    // Try to send verification email
    try {
      await sendVerificationEmail(newUser.email, verificationToken);

      res.status(201).json({
        status: 'success',
        message: 'Vui lòng kiểm tra email để xác thực tài khoản',
      });
    } catch (emailError) {
      // If email fails, delete the created user and return error
      await User.findByIdAndDelete(newUser._id);
      return next(
        new AppError(
          'Failed to send verification email. Please try again.',
          500
        )
      );
    }
  } catch (error) {
    return next(new AppError('Error creating user account', 400));
  }
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  const user = await User.findOne({ verificationToken: token });

  if (!user) {
    return next(new AppError('Invalid verification token', 400));
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Email đã được xác thực thành công',
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Mật khẩu hoặc email không đúng', 401));
  }

  if (!user || user.isLocked) {
    return next(
      new AppError(
        'Your account has been locked! Please contact to admin for more infomation',
        401
      )
    );
  }
  const newUser = await User.findOne({ email }).lean().select('+password');
  // 3) If everything ok, send token to client
  createSendToken(newUser, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized - no token', 401));
  }

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('User not found', 401));
    }
    req.user = currentUser;
    next();
  } catch (err) {
    return next(new AppError('Not authorized - invalid token', 401));
  }
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('Email không tồn tại', 404));
  }

  // 2. Generate random reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // Token expires in 10 minutes
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });
  // 3. Send reset email
  try {
    const resetURL = `${process.env.CLIENT_URL}/resetPassword/${resetToken}`;
    await sendResetPasswordEmail(user.email, resetURL);

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('Gửi email thất bại', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2. If token valid and user exists, set new password
  if (!user) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3. Send success response with new token
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findOne({ _id: req.user.id }).select('+password');

  // 2) Check if POSTed current password is correct
  // console.log(await user.correctPassword(req.body.password, user.password));
  if (!(await user.correctPassword(req.body.password, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }
  // 3) If so, update password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  res.status(200).json({ status: 'success', data: req.user });
});
