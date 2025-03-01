require("dotenv").config();
const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: 'gitfolio_secret', // Change this to a secure secret
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

// Redirect user to GitHub OAuth
app.get('/auth/github', (req, res) => {
  const redirectUri = `${process.env.SERVER_URL}/auth/github/callback`;
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user`);
});

// GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, { headers: { Accept: 'application/json' } });

    req.session.githubToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${req.session.githubToken}` }
    });

    req.session.githubUser = userRes.data.login;
    res.send("<h2>✅ Login Successful! You can now use the Telegram Bot.</h2><script>setTimeout(()=>window.close(),3000);</script>");

  } catch (error) {
    console.error("❌ GitHub OAuth Error:", error);
    res.status(500).send("GitHub login failed.");
  }
});

// Fetch GitHub Stats
app.get('/github/stats', async (req, res) => {
  if (!req.session.githubToken) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const username = req.session.githubUser;
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${req.session.githubToken}` }
    });

    res.json({
      name: response.data.name,
      total_repos: response.data.public_repos,
      followers: response.data.followers,
      following: response.data.following
    });

  } catch (error) {
    console.error("❌ Failed to fetch GitHub stats:", error);
    res.status(500).json({ error: "Failed to fetch GitHub stats" });
  }
});

// Fetch GitHub Contributions
app.get("/github/contributions", async (req, res) => {
  console.log("🔍 Checking Session Data:", req.session); // Debugging

  if (!req.session.githubToken) {
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
      { headers: { Authorization: `Bearer ${req.session.githubToken}` } }
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

