const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    require: [true, 'Please tell us your first name'],
    maxlength: [46, 'A first name must have less than 46 characters'],
  },
  lastName: {
    type: String,
    require: [true, 'Please tell us your last name'],
    maxlength: [46, 'A last name must have less than 46 characters'],
  },
  email: {
    type: String,
    require: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
    default: '/img/default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  addresses: [
    {
      fullName: {
        type: String,
        require: [true, 'Please provide name'],
      },
      phoneNo: {
        type: String,
        require: [true, 'Please provide phone number'],
      },
      address: {
        type: String,
        require: [true, 'Please provide address'],
      },
      city: {
        type: String,
        require: [true, 'Please provide city'],
      },
      district: {
        type: String,
        require: [true, 'Please provide district'],
      },
      ward: {
        type: String,
        require: [true, 'Please provide ward'],
      },
    },
  ],
  password: {
    type: String,
    require: [true, 'Please provide your password'],
    minlength: [8, 'Please provide a password with at lease 8 characters'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    require: [true, 'Please confirm your password'],
    validate: {
      // Just work on CREATE and SAVE
      validator: function (val) {
        return this.password === val;
      },
      message: 'Passwords are not the same',
    },
  },
  verificationToken: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
  passwordChangeAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  isLocked: {
    type: Boolean,
    default: false,
  },
});

// hash pwd before save
userSchema.pre('save', async function (next) {
  // only run this func if password was actually modified
  if (!this.isModified('password')) return next();

  // hash the pwd with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  //   delete passwordCofirm field
  this.passwordConfirm = undefined;
  next();
});

// Tạo thời gian thay đổi pwd
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  // Minus 1s so that passwordChangeAt will before the JWT token when it was created - sometimes the passwordChangeAt will be late a bit
  this.passwordChangeAt = Date.now() - 1000;
  next();
});

// So sánh 2 password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// So sánh thời gian password đã đc modified với tgian (để xét tgian tạo token)
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangeAt) {
    const changedTimestamp = parseInt(
      this.passwordChangeAt.getTime() / 1000,
      10
    );
    // If the time of JWT was issued after changed password it return true
    // thời gian mà JWT được sinh ra mà sau khi thời gian đổi password thì trả về false
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  //   console.log({ resetToken }, this.passwordResetToken);
  // 10'=10 *60s*1000ms
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
