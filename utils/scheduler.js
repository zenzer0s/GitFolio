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