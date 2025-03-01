require("dotenv").config();
const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Routes
app.get("/auth/github", passport.authenticate("github", { scope: ["read:user"] }));

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    res.send("✅ GitHub Login Successful! You can close this tab.");
  }
);

app.get("/github/stats", async (req, res) => {
  try {
    const username = "zenzer0s"; // Replace with logged-in user's GitHub username
    const response = await axios.get(`https://api.github.com/users/${username}`);

    res.json({
      name: response.data.name,
      total_repos: response.data.public_repos,
      followers: response.data.followers,
      following: response.data.following,
      contributions: "🚧 Coming soon!",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch GitHub stats" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});

