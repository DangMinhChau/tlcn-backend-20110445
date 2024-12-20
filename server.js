const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNCATCH EXCEPTION! SHUTTING DOWN');
  console.log(err);
  console.log(err.name, err.message);
  process.exit(1);
});
dotenv.config();
const app = require('./app');

const DB = process.env.DATABASE_URI.replace(
  '<DB_USERNAME>',
  process.env.DB_USERNAME
).replace('<DB_PASSWORD>', process.env.DB_PASSWORD);
mongoose.connect(DB, { dbName: process.env.DB_NAME }).then(() => {
  console.log('DB connection successfull');
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`app running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLE REJECTION! SHUTTING DOWN');
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
