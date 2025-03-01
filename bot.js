const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');
const { scheduleUserUpdates, scheduleStreakReminder } = require('./utils/scheduler');

class GitFolioBot {
  constructor() {
    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
    this.serverUrl = config.SERVER_URL;
    this.userSessions = new Map();
    
    this.initializeCommands();
    console.log("🤖 Telegram Bot is running...");
  }
  
  // Initialize all bot commands
  initializeCommands() {
    // Command handlers
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/login/, (msg) => this.handleLogin(msg.chat.id));
    this.bot.onText(/\/stats/, (msg) => this.handleStats(msg.chat.id));
    this.bot.onText(/\/contributions/, (msg) => this.handleContributions(msg.chat.id));
    this.bot.onText(/\/repos/, (msg) => this.handleRepos(msg.chat.id));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg.chat.id));
    this.bot.onText(/\/debug/, (msg) => this.handleDebug(msg.chat.id));
    this.bot.onText(/\/streak/, (msg) => this.handleStreak(msg.chat.id)); // New streak command
    this.bot.onText(/\/reminder/, (msg) => this.handleSetReminder(msg)); // New reminder command
    
    // Callback query handler
    this.bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(callbackQuery));
  }
  
  // Generate a unique session token
  generateSessionToken(userId) {
    return crypto.randomBytes(16).toString('hex');
  }
  
  // Handle /start command
  handleStart(msg) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔑 Login with GitHub", callback_data: "login" }],
        [{ text: "ℹ️ About GitFolio", callback_data: "about" }]
      ]
    };
    
    this.bot.sendMessage(msg.chat.id, 
      "🚀 *Welcome to GitFolio Bot!*\n\n" +
      "Your personal GitHub productivity assistant. " +
      "Login to access your GitHub stats, repositories, track contribution streaks, and get motivated to code daily!",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard
      }
    );
  }
  
  // Handle callback queries from inline keyboards
  handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    
    // Handle different stat periods
    if (action.startsWith('stats_')) {
      const period = action.split('_')[1];
      this.handleStatsByPeriod(chatId, period);
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    
    switch(action) {
      case 'login':
        this.handleLogin(chatId);
        break;
      case 'about':
        this.bot.sendMessage(chatId, 
          "📱 *GitFolio Bot*\n\n" +
          "A convenient way to access GitHub stats right from Telegram. " +
          "Connect your GitHub account to get insights about your repositories, " +
          "contributions, followers, and track your coding streaks to stay motivated!\n\n" +
          "Use /help to see all available commands.",
          { parse_mode: "Markdown" }
        );
        break;
      case 'refresh_stats':
        this.handleStats(chatId);
        break;
      case 'view_contributions':
        this.handleContributions(chatId);
        break;
      case 'view_repos':
        this.handleRepos(chatId);
        break;
      case 'view_streak':
        this.handleStreak(chatId);
        break;
      case 'enable_reminders':
        this.enableReminders(chatId);
        break;
      case 'disable_reminders':
        this.disableReminders(chatId);
        break;
    }
    
    // Answer callback query to remove the "loading" state
    this.bot.answerCallbackQuery(callbackQuery.id);
  }
  
  // Handle GitHub login
  handleLogin(chatId) {
    // Generate a unique token for this user session
    const sessionToken = this.generateSessionToken(chatId);
    
    // Store both the token and the chat ID
    this.userSessions.set(chatId, sessionToken);
    console.log(`Generated session token for chat ${chatId}: ${sessionToken}`);
    
    // Create a text message with the login instructions and URL
    const loginUrl = `${this.serverUrl}/auth/github?token=${sessionToken}&chatId=${chatId}`;
    
    this.bot.sendMessage(chatId, 
      "🔗 *GitHub Authentication*\n\n" +
      "Please copy and paste the following URL into your browser to connect your GitHub account:\n\n" +
      `\`${loginUrl}\`\n\n` +
      "After authentication, you'll be able to access your GitHub stats and streaks!",
      { parse_mode: "Markdown" }
    );
  }
  
  // Handle stats command
  async handleStats(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    // Show "typing..." indicator
    this.bot.sendChatAction(chatId, "typing");
    
    try {
      const response = await axios.get(`${this.serverUrl}/github/stats?token=${sessionToken}&chatId=${chatId}`);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      // Create a stats message
      const statsMessage = 
        "📊 *Your GitHub Profile*\n\n" +
        `👤 *Name:* ${response.data.name || 'Not set'}\n` +
        `📚 *Repositories:* ${response.data.total_repos}\n` +
        `👥 *Followers:* ${response.data.followers}\n` +
        `🔄 *Following:* ${response.data.following}\n`;
      
      // Add contributions if available
      const contributionsText = response.data.contributions 
        ? `🏆 *Contributions:* ${response.data.contributions}\n` 
        : '';
      
      // Create inline keyboard with quick stats buttons
      const keyboard = {
        inline_keyboard: [
          [
            { text: "📅 Weekly Stats", callback_data: "stats_weekly" },
            { text: "📆 Monthly Stats", callback_data: "stats_monthly" }
          ],
          [
            { text: "📌 Today's Stats", callback_data: "stats_today" },
            { text: "📊 All-Time Stats", callback_data: "stats_alltime" }
          ],
          [
            { text: "🔥 View Streak", callback_data: "view_streak" },
            { text: "🔄 Refresh Stats", callback_data: "refresh_stats" }
          ],
          [
            { text: "📊 View Contributions", callback_data: "view_contributions" },
            { text: "📚 View Repositories", callback_data: "view_repos" }
          ]
        ]
      };
      
      this.bot.sendMessage(chatId, statsMessage + contributionsText, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error("Error fetching stats:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle stats by specific time period
  async handleStatsByPeriod(chatId, period) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    this.bot.sendChatAction(chatId, "typing");
    
    try {
      const response = await axios.get(
        `${this.serverUrl}/github/stats/period?token=${sessionToken}&chatId=${chatId}&period=${period}`
      );
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      let title;
      switch(period) {
        case 'today':
          title = "Today's GitHub Activity";
          break;
        case 'weekly':
          title = "Weekly GitHub Activity (Last 7 Days)";
          break;
        case 'monthly':
          title = "Monthly GitHub Activity (Last 30 Days)";
          break;
        case 'alltime':
          title = "All-Time GitHub Stats";
          break;
        default:
          title = "GitHub Activity";
      }
      
      const stats = response.data;
      let message = `📊 *${title}*\n\n`;
      
      if (period === 'today') {
        message += `✅ *Commits Today:* ${stats.commits || 0}\n`;
        message += `📁 *Repositories Updated:* ${stats.repos?.length || 0}\n`;
        message += `⏱️ *Coding Time:* ${stats.codingTime || 'N/A'}\n`;
        
        if (stats.repos && stats.repos.length > 0) {
          message += "\n*Repositories worked on:*\n";
          stats.repos.forEach(repo => {
            message += `• ${repo.name} (${repo.commits} commits)\n`;
          });
        }
      } else {
        message += `✅ *Total Commits:* ${stats.commits || 0}\n`;
        message += `📁 *Active Repositories:* ${stats.activeRepos || 0}\n`;
        message += `🔥 *Current Streak:* ${stats.currentStreak || 0} days\n`;
        
        if (period === 'alltime') {
          message += `🏆 *Longest Streak:* ${stats.longestStreak || 0} days\n`;
          message += `📈 *Total Contributions:* ${stats.totalContributions || 0}\n`;
        }
      }
      
      // Back to main stats button
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Back to Main Stats", callback_data: "refresh_stats" }]
        ]
      };
      
      this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error(`Error fetching ${period} stats:`, error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle repositories command
  async handleRepos(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    this.bot.sendChatAction(chatId, "typing");
    
    try {
      const response = await axios.get(`${this.serverUrl}/github/repos?token=${sessionToken}&chatId=${chatId}`);
      
      if (!response.data.repos || response.data.repos.length === 0) {
        return this.bot.sendMessage(chatId, "📚 You don't have any repositories yet.");
      }
      
      let reposMessage = "📚 *Your GitHub Repositories:*\n\n";
      
      response.data.repos.forEach((repo, index) => {
        reposMessage += `${index + 1}. *${repo.name}*\n`;
        if (repo.description) reposMessage += `   ${repo.description}\n`;
        reposMessage += `   ⭐ ${repo.stars} | 🍴 ${repo.forks} | 💻 ${repo.language || 'N/A'}\n\n`;
      });
      
      this.bot.sendMessage(chatId, reposMessage, { parse_mode: "Markdown" });
      
    } catch (error) {
      console.error("Error fetching repos:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle contributions command
  async handleContributions(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    this.bot.sendChatAction(chatId, "typing");
    
    try {
      const response = await axios.get(`${this.serverUrl}/github/contributions?token=${sessionToken}&chatId=${chatId}`);
      
      // First send contribution text summary
      await this.bot.sendMessage(chatId, 
        `🏆 *Your GitHub Contributions*\n\n` +
        `Total contributions this year: ${response.data.totalContributions || 0}`,
        { parse_mode: "Markdown" }
      );
      
      // Then fetch and send the streak graph
      await this.sendStreakGraph(chatId, sessionToken);
      
    } catch (error) {
      console.error("Error fetching contributions:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle streak command - specific for viewing streak info
  async handleStreak(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    this.bot.sendChatAction(chatId, "typing");
    
    try {
      const response = await axios.get(`${this.serverUrl}/github/streak?token=${sessionToken}&chatId=${chatId}`);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      const streak = response.data;
      
      // Create motivational message based on streak length
      let motivationalMsg = "";
      if (streak.currentStreak >= 30) {
        motivationalMsg = "🔥 *INCREDIBLE STREAK!* You're absolutely crushing it! 🔥";
      } else if (streak.currentStreak >= 14) {
        motivationalMsg = "🔥 *Amazing dedication!* You're building a strong coding habit!";
      } else if (streak.currentStreak >= 7) {
        motivationalMsg = "🔥 *Great work!* Keep that streak going strong!";
      } else if (streak.currentStreak >= 3) {
        motivationalMsg = "🔥 *Good start!* You're building momentum!";
      } else if (streak.currentStreak > 0) {
        motivationalMsg = "🔥 *Keep it up!* Every day counts!";
      } else {
        motivationalMsg = "Let's start a new streak today! 💪";
      }
      
      const streakMessage = 
        `${motivationalMsg}\n\n` +
        `*Current Streak:* ${streak.currentStreak} days\n` +
        `*Longest Streak:* ${streak.longestStreak} days\n` +
        `*Total Contributions:* ${streak.totalContributions}\n` +
        `*Today's Contributions:* ${streak.todayContributions || 0}\n`;
      
      // Send text info
      await this.bot.sendMessage(chatId, streakMessage, { parse_mode: "Markdown" });
      
      // Send graphical streak info
      await this.sendStreakGraph(chatId, sessionToken);
      
      // Create reminder toggle button
      const reminderStatus = streak.reminderEnabled ? 'Disable' : 'Enable';
      const reminderAction = streak.reminderEnabled ? 'disable_reminders' : 'enable_reminders';
      
      const keyboard = {
        inline_keyboard: [
          [{ text: `${reminderStatus} Daily Reminders`, callback_data: reminderAction }],
          [{ text: "🔙 Back to Main Stats", callback_data: "refresh_stats" }]
        ]
      };
      
      this.bot.sendMessage(chatId, 
        `*Streak Reminders*\n\n` +
        `Reminders will notify you at 8 PM if you haven't made any contributions for the day.\n` +
        `Status: ${streak.reminderEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard
        }
      );
      
    } catch (error) {
      console.error("Error fetching streak:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Send streak graph as image
  async sendStreakGraph(chatId, sessionToken) {
    try {
      // Fetch the contribution graph image
      const graphUrl = `${this.serverUrl}/github/streak/graph?token=${sessionToken}&chatId=${chatId}`;
      
      // Send it as a photo
      await this.bot.sendPhoto(chatId, graphUrl, {
        caption: "📊 Your GitHub Contribution Graph"
      });
    } catch (error) {
      console.error("Error sending streak graph:", error.message);
      this.bot.sendMessage(chatId, "Unable to generate streak graph. Please try again later.");
    }
  }
  
  // Enable reminders for a user
  async enableReminders(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    try {
      await axios.post(`${this.serverUrl}/github/reminders/enable`, {
        token: sessionToken,
        chatId: chatId
      });
      
      // Schedule reminder for this user
      scheduleStreakReminder(chatId, this);
      
      this.bot.sendMessage(chatId, 
        "✅ *Streak Reminders Enabled*\n\n" +
        "You'll now receive a reminder at 8 PM if you haven't made any contributions for the day.",
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      console.error("Error enabling reminders:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Disable reminders for a user
  async disableReminders(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return this.sendLoginRequiredMessage(chatId);
    }
    
    try {
      await axios.post(`${this.serverUrl}/github/reminders/disable`, {
        token: sessionToken,
        chatId: chatId
      });
      
      this.bot.sendMessage(chatId, 
        "❌ *Streak Reminders Disabled*\n\n" +
        "You won't receive daily streak reminders anymore.",
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      console.error("Error disabling reminders:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle reminder setup command
  handleSetReminder(msg) {
    const chatId = msg.chat.id;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Enable Reminders", callback_data: "enable_reminders" }],
        [{ text: "❌ Disable Reminders", callback_data: "disable_reminders" }]
      ]
    };
    
    this.bot.sendMessage(chatId, 
      "⏰ *GitHub Streak Reminders*\n\n" +
      "Enable daily reminders to help maintain your GitHub streak. " +
      "If enabled, I'll remind you at 8 PM if you haven't made any contributions for the day.",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard
      }
    );
  }
  
  // Send morning update to a user
  async sendMorningUpdate(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return; // Skip if user not logged in
    }
    
    try {
      const response = await axios.get(`${this.serverUrl}/github/streak?token=${sessionToken}&chatId=${chatId}`);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      const streak = response.data;
      
      // Create motivational message based on streak
      let motivationalMsg = "";
      if (streak.currentStreak >= 30) {
        motivationalMsg = "Your commitment is truly inspiring! 🌟";
      } else if (streak.currentStreak >= 14) {
        motivationalMsg = "Your consistency is paying off! 💯";
      } else if (streak.currentStreak >= 7) {
        motivationalMsg = "You're building a solid streak! 💪";
      } else if (streak.currentStreak >= 3) {
        motivationalMsg = "You're on a roll! Keep it up! 🚀";
      } else if (streak.currentStreak > 0) {
        motivationalMsg = "Every day counts toward your goals! 🎯";
      } else {
        motivationalMsg = "Today is a perfect day to start a new streak! 💪";
      }
      
      const message = 
        `🌞 *Good Morning, GitHub Developer!*\n\n` +
        `*Current Streak:* ${streak.currentStreak} days\n` +
        `*Longest Streak:* ${streak.longestStreak} days\n\n` +
        `${motivationalMsg}\n\n` +
        `What will you build today? 🛠️`;
      
      this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      
    } catch (error) {
      console.error("Error sending morning update:", error.message);
    }
  }
  
  // Send evening summary to a user
  async sendEveningSummary(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return; // Skip if user not logged in
    }
    
    try {
      const response = await axios.get(
        `${this.serverUrl}/github/stats/period?token=${sessionToken}&chatId=${chatId}&period=today`
      );
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      const stats = response.data;
      
      let message = `🌙 *Evening GitHub Summary*\n\n`;
      
      if (stats.commits > 0) {
        message += `Great job today! 🎉\n\n`;
      }
      
      message += `✅ *Commits Today:* ${stats.commits || 0}\n`;
      
      if (stats.repos && stats.repos.length > 0) {
        message += `📁 *Repositories Updated:* ${stats.repos.length}\n`;
        message += "\n*Worked on:*\n";
        stats.repos.forEach(repo => {
          message += `• ${repo.name} (${repo.commits} commits)\n`;
        });
      } else {
        message += `📁 *Repositories Updated:* 0\n`;
      }
      
      if (stats.codingTime) {
        message += `\n⏱️ *Coding Time:* ${stats.codingTime}\n`;
      }
      
      message += `\n🔥 *Current Streak:* ${stats.currentStreak || 0} days\n`;
      
      if (stats.commits === 0) {
        message += `\n⚠️ *Reminder:* You haven't made any contributions today. Your streak is at risk!`;
      } else {
        message += `\nKeep up the great work! 💪`;
      }
      
      this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      
    } catch (error) {
      console.error("Error sending evening summary:", error.message);
    }
  }
  
  // Send streak reminder to a user
  async sendStreakReminder(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    if (!sessionToken) {
      return; // Skip if user not logged in
    }
    
    try {
      const response = await axios.get(
        `${this.serverUrl}/github/stats/period?token=${sessionToken}&chatId=${chatId}&period=today`
      );
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      const stats = response.data;
      
      // Only send reminder if user hasn't made any contributions today
      if (stats.commits === 0) {
        const streakResponse = await axios.get(`${this.serverUrl}/github/streak?token=${sessionToken}&chatId=${chatId}`);
        const currentStreak = streakResponse.data.currentStreak || 0;
        
        let message = `⚠️ *STREAK REMINDER*\n\n`;
        
        if (currentStreak > 0) {
          message += `Yo, no commits yet today! Don't break your ${currentStreak}-day streak! 🔥\n\n`;
          message += `There's still time to make a contribution and keep your momentum going.`;
        } else {
          message += `You haven't made any contributions today. Start a new streak! 💪\n\n`;
          message += `Even a small commit can help build a daily coding habit.`;
        }
        
        this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      }
      
    } catch (error) {
      console.error("Error sending streak reminder:", error.message);
    }
  }
  
  // Handle help command
  handleHelp(chatId) {
    const helpMessage = 
      "🤖 *GitFolio Bot Commands*\n\n" +
      "• /start - Initialize the bot\n" +
      "• /login - Connect your GitHub account\n" +
      "• /stats - View your GitHub statistics\n" +
      "• /streak - Check your contribution streak\n" +
      "• /repos - List your repositories\n" +
      "• /contributions - View contribution graph\n" +
      "• /reminder - Set up daily streak reminders\n" +
      "• /help - Show this help message";
    
    this.bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  }
  
  // Handle debug command
  handleDebug(chatId) {
    const sessionToken = this.userSessions.get(chatId);
    
    let debugInfo = "🔍 *Debug Info*\n\n";
    debugInfo += `Chat ID: \`${chatId}\`\n`;
    debugInfo += `Session Token: ${sessionToken ? `\`${sessionToken}\`` : "Not found"}\n`;
    debugInfo += `Server URL: \`${this.serverUrl}\`\n`;
    
    this.bot.sendMessage(chatId, debugInfo, { parse_mode: "Markdown" });
  }
  
  // Helper method for login required message
  sendLoginRequiredMessage(chatId) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔑 Login with GitHub", callback_data: "login" }]
      ]
    };
    
    return this.bot.sendMessage(chatId, 
      "❌ You're not logged in yet. Please login with GitHub first.",
      { reply_markup: keyboard }
    );
  }
  
  // Helper method for API errors
  handleApiError(chatId, error) {
    const errorMessage = error.response?.data?.error || error.message || "Unknown error";
    this.bot.sendMessage(chatId, 
      `❌ Error: ${errorMessage}\n\nPlease try logging in again using /login`
    );
  }
  
  // Get session token for a chat ID - used by server
  getSessionToken(chatId) {
    return this.userSessions.get(chatId);
  }
}

// Create and export bot instance
const gitFolioBot = new GitFolioBot();
module.exports = gitFolioBot;