require("dotenv").config();
const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");
const axios = require("axios");

// Custom session storage to link Telegram users with their GitHub sessions
const userSessions = new Map();

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'gitfolio_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.SERVER_URL + "/auth/github/callback",
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

// Debug middleware
app.use((req, res, next) => {
  console.log(`📝 Request Path: ${req.path}`);
  console.log(`🔑 Session ID: ${req.sessionID}`);
  if (req.query.token) {
    console.log(`🔐 Token from query: ${req.query.token}`);
    const session = userSessions.get(req.query.token);
    console.log(`🔍 Found session:`, session ? 'Yes' : 'No');
  }
  next();
});

// Redirect user to GitHub OAuth - Now captures token and chatId
app.get('/auth/github', (req, res) => {
  const sessionToken = req.query.token;
  const chatId = req.query.chatId;
  
  if (sessionToken && chatId) {
    // Store these in session for retrieval after OAuth
    req.session.telegramToken = sessionToken;
    req.session.telegramChatId = chatId;
    console.log(`✅ Stored Telegram session token: ${sessionToken} for chat ${chatId}`);
  }
  
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

    const accessToken = tokenRes.data.access_token;
    
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Save GitHub data and token in session
    req.session.githubToken = accessToken;
    req.session.githubUser = userRes.data.login;
    req.session.githubUserData = userRes.data;
    
    console.log("✅ GitHub Authentication Success!");
    console.log(`👤 GitHub User: ${userRes.data.login}`);
    
    // Link the Telegram session with GitHub data
    if (req.session.telegramToken && req.session.telegramChatId) {
      const sessionToken = req.session.telegramToken;
      
      // Store GitHub token against the Telegram session token
      userSessions.set(sessionToken, {
        githubToken: accessToken,
        githubUser: userRes.data.login,
        userData: userRes.data,
        chatId: req.session.telegramChatId
      });
      
      console.log(`🔗 Linked GitHub account for chat ${req.session.telegramChatId}`);
      console.log(`🔑 Session token: ${sessionToken}`);
      console.log(`👥 Current sessions:`, Array.from(userSessions.keys()));
    } else {
      console.log("⚠️ No Telegram token found in session!");
      console.log("Session data:", req.session);
    }
    
    res.send(`
      <html>
        <head>
          <title>GitHub Authentication Success</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background-color: #0d1117;
              color: #c9d1d9;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .container {
              max-width: 500px;
              padding: 30px;
              background-color: #161b22;
              border-radius: 6px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            h1 {
              color: #58a6ff;
              margin-bottom: 20px;
            }
            .success-icon {
              color: #238636;
              font-size: 48px;
              margin-bottom: 20px;
            }
            .message {
              margin-bottom: 30px;
              line-height: 1.5;
            }
            .close-button {
              background-color: #238636;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .close-button:hover {
              background-color: #2ea043;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>GitHub Authentication Successful!</h1>
            <div class="message">
              Your GitHub account has been successfully connected to the GitFolio Bot.
              You can now use commands like /stats and /contributions in Telegram.
            </div>
            <button class="close-button" onclick="window.close()">Close Window</button>
            <script>
              setTimeout(() => {
                window.close();
              }, 5000);
            </script>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ GitHub OAuth Error:", error);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body { font-family: Arial; text-align: center; padding: 40px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h2 class="error">⚠️ GitHub login failed</h2>
          <p>Please try again or contact support.</p>
          <button onclick="window.close()">Close</button>
        </body>
      </html>
    `);
  }
});

// Fetch GitHub Stats - Now with better debugging
app.get('/github/stats', async (req, res) => {
  const sessionToken = req.query.token;
  
  console.log(`📊 Stats request with token: ${sessionToken}`);
  console.log(`📋 All tokens:`, Array.from(userSessions.keys()));
  
  const session = userSessions.get(sessionToken);
  
  if (!session) {
    console.log("❌ No session found for token");
    return res.status(401).json({ error: "User not authenticated - No session found" });
  }
  
  if (!session.githubToken) {
    console.log("❌ No GitHub token in session");
    return res.status(401).json({ error: "User not authenticated - No GitHub token" });
  }

  console.log(`✅ Found session for user: ${session.githubUser}`);
  
  try {
    // Fetch basic user data
    const username = session.githubUser;
    console.log(`🔍 Fetching data for GitHub user: ${username}`);
    
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${session.githubToken}` }
    });

    console.log(`👤 Got user data for: ${response.data.login}`);

    // Fetch contributions data
    const graphqlQuery = {
      query: `
        query {
          viewer {
            contributionsCollection {
              contributionCalendar {
                totalContributions
              }
            }
          }
        }
      `
    };

    console.log("🔍 Fetching contributions data...");
    
    const contributionsResponse = await axios.post(
      "https://api.github.com/graphql",
      graphqlQuery,
      { headers: { Authorization: `Bearer ${session.githubToken}` } }
    );

    const totalContributions = 
      contributionsResponse.data.data.viewer.contributionsCollection.contributionCalendar.totalContributions;

    console.log(`🏆 Total contributions: ${totalContributions}`);

    const userData = {
      name: response.data.name || response.data.login,
      total_repos: response.data.public_repos,
      followers: response.data.followers,
      following: response.data.following,
      contributions: totalContributions
    };
    
    console.log("✅ Successfully fetched all GitHub data");
    res.json(userData);

  } catch (error) {
    console.error("❌ Failed to fetch GitHub stats:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    res.status(500).json({ error: "Failed to fetch GitHub stats: " + error.message });
  }
});

// Fetch GitHub Contributions
app.get("/github/contributions", async (req, res) => {
  const sessionToken = req.query.token;
  const session = userSessions.get(sessionToken);
  
  if (!session || !session.githubToken) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const query = `
      query {
        viewer {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      "https://api.github.com/graphql",
      { query },
      { headers: { Authorization: `Bearer ${session.githubToken}` } }
    );

    const contributionData = response.data.data.viewer.contributionsCollection.contributionCalendar;

    res.json({
      totalContributions: contributionData.totalContributions,
      contributionCalendar: contributionData.weeks
    });
  } catch (error) {
    console.error("❌ GitHub API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch contributions" });
  }
});

// Fetch repositories
app.get('/github/repos', async (req, res) => {
  const sessionToken = req.query.token;
  const session = userSessions.get(sessionToken);
  
  if (!session || !session.githubToken) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  
  try {
    const response = await axios.get(`https://api.github.com/user/repos?sort=updated&per_page=5`, {
      headers: { Authorization: `Bearer ${session.githubToken}` }
    });
    
    const repos = response.data.map(repo => ({
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url
    }));
    
    res.json({ repos });
  } catch (error) {
    console.error("❌ Failed to fetch repositories:", error);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// Debug session data
app.get('/debug/session', (req, res) => {
  res.json({
    expressSession: req.session,
    customSessions: Array.from(userSessions.entries()).map(([key, value]) => ({
      key,
      chatId: value.chatId,
      githubUser: value.githubUser
    }))
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});