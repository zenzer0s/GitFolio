const cron = require('node-cron');

// Schedule session cleanup
function scheduleSessionCleanup(sessionManager) {
  // Clean up expired sessions every day at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled session cleanup');
    sessionManager.cleanupExpiredSessions();
  });
}

// Schedule morning updates for a specific user (8 AM)
function scheduleMorningUpdate(chatId, bot) {
  cron.schedule('0 8 * * *', () => {
    console.log(`Sending morning update to chat ${chatId}`);
    bot.sendMorningUpdate(chatId);
  });
}

// Schedule evening summaries for a specific user (10 PM)
function scheduleEveningSummary(chatId, bot) {
  cron.schedule('0 22 * * *', () => {
    console.log(`Sending evening summary to chat ${chatId}`);
    bot.sendEveningSummary(chatId);
  });
}

// Schedule streak reminder for a specific user (8 PM)
function scheduleStreakReminder(chatId, bot) {
  cron.schedule('0 20 * * *', () => {
    console.log(`Checking streak reminder for chat ${chatId}`);
    bot.sendStreakReminder(chatId);
  });
}

// Schedule all user-related updates
function scheduleUserUpdates(chatId, bot) {
  scheduleMorningUpdate(chatId, bot);
  scheduleEveningSummary(chatId, bot);
  scheduleStreakReminder(chatId, bot);
  
  console.log(`Scheduled all updates for chat ${chatId}`);
}

module.exports = {
  scheduleSessionCleanup,
  scheduleUserUpdates,
  scheduleStreakReminder
};