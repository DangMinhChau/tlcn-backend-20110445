// getProductById nhớ populate reviews
const { uploadCloud } = require('../configs/cloudinary');
const AppError = require('./../utils/appError');
const Product = require('./../models/productModel');
const catchAsync = require('./../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

exports.uploadProductImages = uploadCloud.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'images', maxCount: 4 },
]);

exports.saveProductImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // Save cover image URL
  if (req.files.coverImage) {
    req.body.coverImage = req.files.coverImage[0].path;
  }

  // Save detail images URLs
  if (req.files.images) {
    req.body.images = req.files.images.map((file) => file.path);
  }
  next();
});

exports.resizeProductImages = catchAsync(async (req, res, next) => {
  if (!req.files) {
    return next(new AppError('Please upload product images', 400));
  }

  try {
    // Handle cover image
    if (req.files.coverImage) {
      req.body.coverImage = req.files.coverImage[0].path;
    }

    // Handle detail images
    if (req.files.images) {
      req.body.images = req.files.images.map((file) => file.path);
    }

    next();
  } catch (error) {
    return next(new AppError('Error uploading images. Please try again.', 500));
  }
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  if (typeof req.body.inventory === 'string') {
    try {
      req.body.inventory = JSON.parse(req.body.inventory);
    } catch (err) {
      return next(new AppError('Invalid inventory format', 400));
    }
  }
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: updatedProduct,
  });
});

// DELETE thì chỉ set isShow=false thôi
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isShow: req.body.isShow },
    {
      new: true,
    }
  );
  if (!product) {
    return next(new AppError('No document found with that ID', 404));
  }
  res.status(201).json({ satus: 'success' });
});

exports.updateProductInventory = catchAsync(async (req, res, next) => {
  if (!req.body.inventory) return next();

  if (typeof req.body.inventory === 'string') {
    req.body.inventory = JSON.parse(req.body.inventory);
  }
  const { inventory: productInventory } = await Product.findById(req.params.id);

  const newInventory = productInventory.map((item) => {
    for (let i = 0; i < req.body.inventory.length; i++) {
      if (item.size === req.body.inventory[i].size) {
        item.stock = req.body.inventory[i].stock;
      }
    }
    return item;
  });
  req.body.inventory = [...newInventory];
  return next();
});

// backend/controllers/productController.js
exports.createProduct = catchAsync(async (req, res, next) => {
  if (typeof req.body.inventory === 'string') {
    try {
      req.body.inventory = JSON.parse(req.body.inventory);
    } catch (err) {
      return next(new AppError('Invalid inventory format', 400));
    }
  }
  const newProduct = await Product.create(req.body);
  res.status(201).json({
    status: 'success',
    data: newProduct,
  });
});

exports.getAllProducts = catchAsync(async (req, res, next) => {
  // Create base query
  const baseQuery = Product.find().lean().populate({ path: 'reviews' });
  // Apply features
  const features = new APIFeatures(baseQuery, req.query)
    .filter()
    .sort()
    .paginate();

  // Execute query with total count
  const [products, total] = await Promise.all([
    features.query,
    Product.countDocuments(features.query._conditions),
  ]);

  // Calculate pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(total / limit);

  // Send response
  res.status(200).json({
    status: 'success',
    results: products.length,
    totalPage: totalPages,
    currentPage: page,
    data: {
      data: products,
    },
  });
});
exports.getProductById = catchAsync(async (req, res, next) => {
  const query = Product.findById(req.params.id)
    .lean()
    .populate({ path: 'reviews' });
  const product = await query;
  // eslint-disable-next-line arrow-body-style

  if (!product) {
    return next(new AppError('No document found with that ID', 404));
  }
  res.status(200).json({ status: 'success', data: { data: product } });
});

exports.getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $match: { isShow: { $ne: false } },
      },
      {
        $group: {
          _id: '$category',
          numProducts: { $sum: 1 },
          numRatings: { $sum: '$numberOfReview' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
      {
        $sort: { avgPrice: 1 },
      },
      {
        $addFields: { category: '$_id' },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    const newStats = await Product.populate(stats, {
      path: 'category',
      select: 'name',
    });

    res.status(200).json({
      status: 'success',
      data: {
        stats: newStats,
      },
    });
  } catch (err) {
    res.status(404).json({
      status: 'fail',
      message: err,
    });
  }
};

// tính sold amount theo từng sản phẩm lấy top 3 sp

exports.bestSeller = catchAsync(async (req, res) => {
  const top = req.params.top * 1;

  const stats = await Product.aggregate([
    {
      $match: { isShow: { $ne: false } },
    },
    { $unwind: '$inventory' },
    {
      $group: {
        _id: '$sku',
        sold: { $sum: '$inventory.soldAmount' },
      },
    },
    { $sort: { sold: -1 } },
    { $limit: top },
  ]);

  const products = await Promise.all(
    stats.map((item) =>
      Product.findOne({ sku: item._id })
        .select('sku _id name coverImage')
        .lean()
    )
  );

  const newStats = stats.map((stat, index) => ({
    ...stat,
    product: products[index],
  }));

  res.status(200).json({
    status: 'success',
    data: {
      stats: newStats,
    },
  });
});
