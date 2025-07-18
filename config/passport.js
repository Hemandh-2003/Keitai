const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Assuming User is a Mongoose model
require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL, // Use the CALLBACK_URL from .env
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create a user
        let user = await User.findOne({ googleId: profile.id });
        // console.log('user:17',user)
        if (!user) {
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
          });
          await user.save();
          console.log('the user is ', user)
        }
        done(null, user);
      } catch (err) {
        console.error('Error with GoogleStrategy:', err);
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id); // Serialize user by their ID
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user); // Attach the user to req.user
  } catch (err) {
    console.error('Error deserializing user:', err);
    done(err, null);
  }
});


module.exports = passport;
