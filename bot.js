const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

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
      "Your personal GitHub portfolio assistant. " +
      "Login to access your GitHub stats, repositories, and contributions directly from Telegram.",
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
    
    switch(action) {
      case 'login':
        this.handleLogin(chatId);
        break;
      case 'about':
        this.bot.sendMessage(chatId, 
          "📱 *GitFolio Bot*\n\n" +
          "A convenient way to access GitHub stats right from Telegram. " +
          "Connect your GitHub account to get insights about your repositories, " +
          "contributions, followers, and more.\n\n" +
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
      "After authentication, you'll be able to access your GitHub stats using /stats command.",
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
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 Refresh Stats", callback_data: "refresh_stats" }],
          [{ text: "📊 View Contributions", callback_data: "view_contributions" }],
          [{ text: "📚 View Repositories", callback_data: "view_repos" }]
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
      
      this.bot.sendMessage(chatId, 
        `🏆 *Your GitHub Contributions*\n\n` +
        `Total contributions this year: ${response.data.totalContributions}`,
        { parse_mode: "Markdown" }
      );
      
    } catch (error) {
      console.error("Error fetching contributions:", error.message);
      this.handleApiError(chatId, error);
    }
  }
  
  // Handle help command
  handleHelp(chatId) {
    const helpMessage = 
      "🤖 *GitFolio Bot Commands*\n\n" +
      "• /start - Initialize the bot\n" +
      "• /login - Connect your GitHub account\n" +
      "• /stats - View your GitHub statistics\n" +
      "• /repos - List your repositories\n" +
      "• /contributions - View contribution graph\n" +
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