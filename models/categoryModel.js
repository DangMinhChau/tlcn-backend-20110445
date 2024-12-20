const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = mongoose.Schema(
  {
    name: {
      type: String,
      require: [true, 'Category must have a name'],
      unique: true,
    },
    slug: String,
    isShow: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
categorySchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});
categorySchema.virtual('products', {
  ref: 'Product',
  foreignField: 'category',
  localField: '_id',
});
const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
