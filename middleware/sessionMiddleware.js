// sessionMiddleware.js

const session = require('express-session');
const MongoStore = require('connect-mongo');  // To store session in MongoDB

const sessionMiddleware = (app) => {
  app.use(
    session({
      secret: 'your_secret_key', // Replace with your secret key
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/your_database_name', // Replace with your MongoDB URL
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, // Session expires after 14 days
      }),
      cookie: {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
      },
    })
  );
};

module.exports = sessionMiddleware;
