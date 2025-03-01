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
  DEBUG: process.env.DEBUG === 'true',
  
  // Bot notification schedule times
  SCHEDULE: {
    MORNING_UPDATE: process.env.MORNING_UPDATE_TIME || '0 8 * * *', // 8 AM daily
    EVENING_SUMMARY: process.env.EVENING_SUMMARY_TIME || '0 22 * * *', // 10 PM daily
    STREAK_REMINDER: process.env.STREAK_REMINDER_TIME || '0 20 * * *', // 8 PM daily
  },
  
  // GitHub API Endpoints
  GITHUB_API: {
    GRAPHQL: 'https://api.github.com/graphql',
    REST_BASE: 'https://api.github.com'
  },
  
  // External Services
  GITHUB_STREAK_STATS_API: 'https://github-readme-streak-stats.herokuapp.com',
  GITHUB_README_STATS_API: 'https://github-readme-stats.vercel.app/api'
};