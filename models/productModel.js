const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A product must have a name'],
    },
    sku: {
      type: String,
      unique: true,
      required: [true, 'A product must have a SKU'],
      uppercase: true,
    },
    description: {
      type: String,
      required: [true, 'A product must have a description'],
      default: 'Sản phẩm chưa có mô tả',
    },
    price: {
      type: Number,
      required: [true, 'A product must have a price'],
    },
    discount: {
      type: Number,
      default: 0,
      validate: {
        validator: function (val) {
          return val >= 0 && val <= 90;
        },
        message: 'discount percent must be between 0 and 90',
      },
    },
    color: {
      type: String,
      required: [true, 'A product must have a color'],
    },
    inventory: [
      {
        size: {
          type: String,
          required: [true, 'Inventory must have a size'],
        },
        stock: {
          type: Number,
          default: 0,
          min: [0, 'Stock must be above 0'],
          required: [true, 'Inventory must have a stock'],
        },
        soldAmount: {
          type: Number,
          default: 0,
          min: [0, 'soldAmount must be above 0'],
        },
      },
    ],

    coverImage: {
      type: String,
      required: [true, 'A product must have a cover image'],
    },
    images: [String],
    parentCategory: {
      type: String,
      enum: ['pants', 'shirts', 'none'],
      default: 'Khác',
      required: [true, 'A product must have a parent category'],
    },
    isShow: {
      type: Boolean,
      default: true,
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'A product must have a category'],
    },
    slug: String,
    averageRate: {
      type: Number,
      default: 5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10,
    },
    numberOfReview: {
      type: Number,
      default: 0,
    },
    createAt: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
productSchema.index({ price: 1, averageRate: -1 });
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id',
  match: { isApproved: true },
});

productSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

productSchema.pre('save', function (next) {
  if (this.description === '')
    this.description =
      'Do màn hình và điều kiện ánh sáng khác nhau, màu sắc thực tế của sản phẩm có thể chênh lệch khoảng 3-5%';
  next();
});

productSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'id name',
  });

  next();
});

productSchema.pre(/^find/, function (next) {
  this.find({ isShow: { $ne: false } });
  this.start = Date.now();

  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
