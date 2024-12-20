const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadProductImages = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'images', maxCount: 4 },
]);

exports.resizeProductImages = catchAsync(async (req, res, next) => {
  if (!req.files || !req.files.coverImage || !req.files.images) return next();

  // console.log('req.body.name: ', req.body.name);
  const productFolderName = `${req.body.name
    .trim()
    .toLowerCase()
    .replaceAll(' ', '-')}-${req.body.color
    .toLowerCase()
    .trim()
    .replaceAll(' ', '-')}`;

  // 1) cover image
  const dir =
    `public/img/products/${req.body.category}/${req.user.id}/${productFolderName}`.replace(
      ' ',
      '-'
    );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true }, (err) => {
      if (err) throw err;
    });
  }
  req.body.coverImage = `product-${productFolderName}-cover.jpeg`.replace(
    ' ',
    '-'
  );
  await sharp(req.files.coverImage[0].buffer)
    .resize(1200, 1200)
    .toFormat('jpeg')
    .jpeg({ quality: 100 })
    .toFile(`${dir}/${req.body.coverImage}`);

  req.body.coverImage = `/img/products/${req.body.category}/${
    req.user.id
  }/${productFolderName.replaceAll(' ', '-')}/${req.body.coverImage}`;
  // 2)images
  req.body.images = [];
  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `product-${productFolderName}-${i + 1}.jpeg`.replaceAll(
        ' ',
        '-'
      );

      await sharp(file.buffer)
        .resize(1200, 1200)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`${dir}/${filename}`);

      req.body.images.push(
        `/img/products/${req.body.category}/${
          req.user.id
        }/${productFolderName.replaceAll(' ', '-')}/${filename}`
      );
    })
  );

  next();
});
