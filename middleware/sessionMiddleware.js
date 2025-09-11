// sessionMiddleware.js

const session = require('express-session');
const MongoStore = require('connect-mongo');  

const sessionMiddleware = (app) => {
  app.use(
    session({
      secret: 'your_secret_key', 
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/your_database_name', 
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, 
      }),
      cookie: {
        httpOnly: true,
        secure: false, 
        maxAge: 14 * 24 * 60 * 60 * 1000, 
      },
    })
  );
};

module.exports = sessionMiddleware;
