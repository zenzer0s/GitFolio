// utils/scheduler.js
/**
 * This file is for scheduling recurring tasks
 * Currently empty, but can be used for:
 * - Weekly summary reports for users
 * - Cleanup of expired sessions
 * - Periodic notifications about GitHub activity
 */

const cron = require('node-cron');

function scheduleSessionCleanup(sessionManager) {
  // Example: Clean up expired sessions every day at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled session cleanup');
    sessionManager.cleanupExpiredSessions();
  });
}

module.exports = {
  scheduleSessionCleanup
};