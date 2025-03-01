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

app.use((req, res, next) => {
  console.log("SESSION DATA:", req.session);
  next();
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      return done(null, { profile, accessToken });
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
  async (req, res) => {
    const { code } = req.query;

    try {
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        { headers: { Accept: "application/json" } }
      );

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        console.log("⚠️ No Access Token Received");
        return res.status(400).json({ error: "Failed to get access token" });
      }

      req.session.accessToken = accessToken; // ✅ Store in session
      req.session.save(() => {  // 🔥 Force save session
        console.log("✅ GitHub Access Token Stored:", accessToken);
        res.redirect("/dashboard"); // Redirect after login
      });

    } catch (error) {
      console.error("❌ GitHub OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
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

app.get("/github/contributions", async (req, res) => {
  console.log("🔍 Checking Session Data:", req.session); // Debugging

  if (!req.session.accessToken) {
    console.log("⚠️ User Not Authenticated");
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const query = `
      query {
        viewer {
          contributionsCollection {
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `;

    const response = await axios.post(
      "https://api.github.com/graphql",
      { query },
      { headers: { Authorization: `Bearer ${req.session.accessToken}` } }
    );

    const totalContributions =
      response.data.data.viewer.contributionsCollection.contributionCalendar.totalContributions;

    res.json({ totalContributions });
  } catch (error) {
    console.error("❌ GitHub API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch contributions" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});

