const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const gitFolioBot = require("./bot");
const githubUtils = require("./utils/github");

class GitFolioServer {
  constructor() {
    this.app = express();
    this.userSessions = new Map();
    
    this.configureMiddleware();
    this.configurePassport();
    this.setupRoutes();
    this.startServer();
  }
  
  configureMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(
      session({
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { 
          secure: config.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      })
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    
    // Debug middleware if debug mode is enabled
    if (config.DEBUG) {
      this.app.use((req, res, next) => {
        console.log(`📝 Request Path: ${req.path}`);
        console.log(`🔑 Session ID: ${req.sessionID}`);
        if (req.query.token) {
          console.log(`🔐 Token from query: ${req.query.token}`);
          const session = this.userSessions.get(req.query.token);
          console.log(`🔍 Found session:`, session ? 'Yes' : 'No');
        }
        next();
      });
    }
    
    // Serve static files from views directory
    this.app.use(express.static(path.join(__dirname, 'views')));
  }
  
  configurePassport() {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.GITHUB_CLIENT_ID,
          clientSecret: config.GITHUB_CLIENT_SECRET,
          callbackURL: `${config.SERVER_URL}/auth/github/callback`,
        },
        (accessToken, refreshToken, profile, done) => {
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
  }
  
  setupRoutes() {
    // GitHub OAuth routes
    this.app.get('/auth/github', this.handleGithubAuth.bind(this));
    this.app.get('/auth/github/callback', this.handleGithubCallback.bind(this));
    
    // API routes
    this.app.get('/github/stats', this.handleGithubStats.bind(this));
    this.app.get('/github/contributions', this.handleContributions.bind(this));
    this.app.get('/github/repos', this.handleRepos.bind(this));
    
    // Debug routes
    if (config.DEBUG) {
      this.app.get('/debug/session', this.handleDebugSession.bind(this));
    }
  }
  
  startServer() {
    const PORT = config.PORT;
    this.app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  }
  
  // Route Handlers
  
  handleGithubAuth(req, res) {
    const sessionToken = req.query.token;
    const chatId = req.query.chatId;
    
    if (sessionToken && chatId) {
      // Store these in session for retrieval after OAuth
      req.session.telegramToken = sessionToken;
      req.session.telegramChatId = chatId;
      console.log(`✅ Stored Telegram session token: ${sessionToken} for chat ${chatId}`);
    }
    
    // Redirect to GitHub authorization
    const redirectUri = `${config.SERVER_URL}/auth/github/callback`;
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user`);
  }
  
  async handleGithubCallback(req, res) {
    const { code } = req.query;
    
    try {
      // Get access token using the code
      const accessToken = await githubUtils.getAccessToken(code);
      
      // Get user data with the token
      const userRes = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const githubUser = userRes.data.login;
      
      // Link the Telegram session with GitHub data
      if (req.session.telegramToken && req.session.telegramChatId) {
        const sessionToken = req.session.telegramToken;
        
        // Store GitHub token against the Telegram session token
        this.userSessions.set(sessionToken, {
          githubToken: accessToken,
          githubUser: githubUser,
          userData: userRes.data,
          chatId: req.session.telegramChatId
        });
        
        console.log(`🔗 Linked GitHub account for chat ${req.session.telegramChatId}`);
      } else {
        console.log("⚠️ No Telegram token found in session!");
      }
      
      // Send success page
      res.sendFile(path.join(__dirname, 'views', 'login.html'), { query: { status: 'success' } });
      
    } catch (error) {
      console.error("❌ GitHub OAuth Error:", error);
      res.sendFile(path.join(__dirname, 'views', 'login.html'), { query: { status: 'error' } });
    }
  }
  
  async handleGithubStats(req, res) {
    const sessionToken = req.query.token;
    
    if (config.DEBUG) {
      console.log(`📊 Stats request with token: ${sessionToken}`);
      console.log(`📋 All tokens:`, Array.from(this.userSessions.keys()));
    }
    
    const session = this.userSessions.get(sessionToken);
    
    if (!session) {
      return res.status(401).json({ error: "User not authenticated - No session found" });
    }
    
    if (!session.githubToken) {
      return res.status(401).json({ error: "User not authenticated - No GitHub token" });
    }
    
    try {
      const userData = await githubUtils.getUserStats(session.githubToken, session.githubUser);
      res.json(userData);
    } catch (error) {
      console.error("❌ Failed to fetch GitHub stats:", error);
      res.status(500).json({ error: "Failed to fetch GitHub stats: " + error.message });
    }
  }
  
  async handleContributions(req, res) {
    const sessionToken = req.query.token;
    const session = this.userSessions.get(sessionToken);
    
    if (!session || !session.githubToken) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    try {
      const contributionData = await githubUtils.fetchContributions(session.githubToken);
      
      res.json({
        totalContributions: contributionData.totalContributions,
        contributionCalendar: contributionData.weeks
      });
    } catch (error) {
      console.error("❌ GitHub API Error:", error);
      res.status(500).json({ error: "Failed to fetch contributions" });
    }
  }
  
  async handleRepos(req, res) {
    const sessionToken = req.query.token;
    const session = this.userSessions.get(sessionToken);
    
    if (!session || !session.githubToken) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    try {
      const repos = await githubUtils.fetchRepositories(session.githubToken);
      res.json({ repos });
    } catch (error) {
      console.error("❌ Failed to fetch repositories:", error);
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  }
  
  // Debug endpoint
  handleDebugSession(req, res) {
    res.json({
      expressSession: req.session,
      customSessions: Array.from(this.userSessions.entries()).map(([key, value]) => ({
        key,
        chatId: value.chatId,
        githubUser: value.githubUser
      }))
    });
  }
}

// Create and start the server
new GitFolioServer();