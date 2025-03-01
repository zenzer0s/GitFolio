// config.js
require('dotenv').config();

module.exports = {
  // Telegram config
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  
  // Server config
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:8000',
  PORT: process.env.PORT || 8000,
  
  // GitHub OAuth config
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  
  // Session config
  SESSION_SECRET: process.env.SESSION_SECRET || 'gitfolio_secret',
  
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Debug flag
  DEBUG: process.env.DEBUG === 'true'
};