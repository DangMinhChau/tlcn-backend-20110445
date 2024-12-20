const mongoose = require('mongoose');

const Product = require('./../models/productModel');
const Voucher = require('./../models/voucherModel');
const AppError = require('../utils/appError');

const orderSchema = new mongoose.Schema(
  {
    orderItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: 'Product',
          required: [true, 'orderItem must belong to a product.'],
        },
        price: {
          type: Number,
          required: [true, 'orderItem must have a price'],
        },
        size: {
          type: String,
          required: [true, 'orderItem must have a size'],
        },
        quantity: {
          type: Number,
          required: [true, 'orderItem must have a quantity'],
          default: 1,
          min: [1, 'Quantity must be above 0'],
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    shippingPrice: {
      type: Number,
      required: true,
    },
    orderStatus: {
      type: String,
      required: true,
      enum: {
        values: ['new', 'processing', 'done', 'fail'],
        message: 'Invalid order status',
      },
      default: 'new',
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['COD', 'PayPal'],
        message: 'Payment method must be either COD or PayPal',
      },
    },
    paymentResult: {
      id: String,
      status: Boolean,
      updateTime: Date,
      email: String,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a user'],
    },
    address: {
      fullName: {
        type: String,
        required: [true, 'Please provide name'],
      },
      phoneNo: {
        type: String,
        required: [true, 'Please provide phone number'],
      },
      address: {
        type: String,
        required: [true, 'Please provide address'],
      },
      city: {
        type: String,
        required: [true, 'Please provide city'],
      },
      district: {
        type: String,
        required: [true, 'Please provide district'],
      },
      ward: {
        type: String,
        required: [true, 'Please provide ward'],
      },
    },
    voucher: {
      type: mongoose.Schema.ObjectId,
      ref: 'Voucher',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.pre('save', function (next) {
  if (this.paymentMethod === 'PayPal' && !this.paymentResult?.id) {
    return next(new AppError('PayPal payment details are required', 400));
  }
  next();
});
orderSchema.pre('save', async function (next) {
  const basePrice = this.orderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  let finalPrice = basePrice + (this.shippingPrice || 0);

  if (this.voucher) {
    const today = new Date();
    const voucher = await Voucher.findById(this.voucher);

    if (!voucher) {
      return next(new AppError('Voucher not found', 400));
    }

    if (voucher.expireDate < today) {
      return next(new AppError('Voucher has expired', 400));
    }

    if (voucher.startDate > today) {
      return next(new AppError('Voucher is not active yet', 400));
    }

    finalPrice = Math.max(0, finalPrice - voucher.discount);
  }

  this.totalPrice = finalPrice;
  next();
});

orderSchema.pre('save', async function (next) {
  // send mail to user that order  belong to (userId in order)
  let enoughStock = true;
  const items = [];
  this.orderItems.forEach(async (orderItem) => {
    items.push(Product.findById(orderItem.product));
  });
  const products = await Promise.all(items);
  // console.log(products);

  // 1 check stock is enough
  this.orderItems.forEach((orderItem) => {
    const product = products.find(
      // trước khi save nên  orderItem.product chưa có populate
      (item) => item._id.toString() === orderItem.product.toString()
    );
    const iventoryOfSize = product.inventory.find(
      (item) => item.size === orderItem.size
    );
    // console.log(iventoryOfSize);
    if (iventoryOfSize.stock < orderItem.quantity) {
      enoughStock = false;
      return next(new AppError('Stock is not enough to create Order', 400));
    }
  });
  // https://stackoverflow.com/questions/66436674/mongodb-updating-the-document-fails-in-a-foreach-loop
  // 2 update stock and soldAmount
  if (enoughStock) {
    // eslint-disable-next-line no-restricted-syntax
    for (const orderItem of this.orderItems) {
      // this.orderItems.forEach(async (orderItem) => {
      // eslint-disable-next-line no-await-in-loop
      const { inventory: productInventory } = await Product.findById(
        orderItem.product
      );

      const product = products.find(
        (item) => item._id.toString() === orderItem.product.toString()
      );
      const iventoryOfSize = product.inventory.find(
        (item) => item.size === orderItem.size
      );
      iventoryOfSize.stock -= orderItem.quantity;
      iventoryOfSize.soldAmount += orderItem.quantity;

      // console.log('========================');
      // console.log('iventoryOfSize: ', iventoryOfSize);
      // console.log('productInventory: ', productInventory[0], productInventory[1]);
      const newInventory = productInventory.map((item) => {
        if (item.size === iventoryOfSize.size) {
          item.stock = iventoryOfSize.stock;
          item.soldAmount = iventoryOfSize.soldAmount;
        }
        return item;
      });
      // console.log('newInventory: ', newInventory[0], newInventory[1]);
      // eslint-disable-next-line no-await-in-loop
      await Product.findOneAndUpdate(
        { _id: orderItem.product },
        { inventory: [...newInventory] },
        {
          new: true,
        }
      );
      // });
    }
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
