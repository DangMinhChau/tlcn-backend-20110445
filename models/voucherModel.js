const mongoose = require('mongoose');

const voucherShema = mongoose.Schema({
  name: {
    type: String,
    require: [true, 'Voucher must have a name'],
    unique: true,
  },
  startDate: Date,
  expireDate: Date,
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const Voucher = mongoose.model('Voucher', voucherShema);

module.exports = Voucher;
