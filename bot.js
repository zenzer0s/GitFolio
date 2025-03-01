require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Store user sessions with unique tokens
const userSessions = new Map(); 

// Generate a unique session token for each user
function generateSessionToken(userId) {
  return crypto.randomBytes(16).toString('hex');
}

// 🛠 Handle "/start"
bot.onText(/\/start/, (msg) => {
    const keyboard = {
        inline_keyboard: [
            [{ text: "🔑 Login with GitHub", callback_data: "login" }],
            [{ text: "ℹ️ About GitFolio", callback_data: "about" }]
        ]
    };
    
    bot.sendMessage(msg.chat.id, 
        "🚀 *Welcome to GitFolio Bot!*\n\n" +
        "Your personal GitHub portfolio assistant. " +
        "Login to access your GitHub stats, repositories, and contributions directly from Telegram.",
        {
            parse_mode: "Markdown",
            reply_markup: keyboard
        }
    );
});

// Handle callback queries
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    
    if (action === 'login') {
        handleLogin(chatId);
    } else if (action === 'about') {
        bot.sendMessage(chatId, 
            "📱 *GitFolio Bot*\n\n" +
            "A convenient way to access GitHub stats right from Telegram. " +
            "Connect your GitHub account to get insights about your repositories, " +
            "contributions, followers, and more.\n\n" +
            "Use /help to see all available commands.",
            { parse_mode: "Markdown" }
        );
    } else if (action === 'refresh_stats') {
        handleStats(chatId);
    } else if (action === 'view_contributions') {
        handleContributions(chatId);
    }
    
    // Answer callback query to remove the "loading" state
    bot.answerCallbackQuery(callbackQuery.id);
});

// 🔑 Handle "/login"
bot.onText(/\/login/, (msg) => {
    handleLogin(msg.chat.id);
});

function handleLogin(chatId) {
    // Generate a unique token for this user session
    const sessionToken = generateSessionToken(chatId);
    
    // Store both the token and the chat ID
    userSessions.set(chatId, sessionToken);
    console.log(`Generated session token for chat ${chatId}: ${sessionToken}`);
    
    // Create a text message with the login instructions and URL
    const loginUrl = `${SERVER_URL}/auth/github?token=${sessionToken}&chatId=${chatId}`;
    
    bot.sendMessage(chatId, 
        "🔗 *GitHub Authentication*\n\n" +
        "Please copy and paste the following URL into your browser to connect your GitHub account:\n\n" +
        `\`${loginUrl}\`\n\n` +
        "After authentication, you'll be able to access your GitHub stats using /stats command.",
        { parse_mode: "Markdown" }
    );
}

// 📊 Fetch Stats
bot.onText(/\/stats/, (msg) => {
    handleStats(msg.chat.id);
});

async function handleStats(chatId) {
    const sessionToken = userSessions.get(chatId);
    
    if (!sessionToken) {
        console.log(`No session token found for chat ${chatId}`);
        const keyboard = {
            inline_keyboard: [
                [{ text: "🔑 Login with GitHub", callback_data: "login" }]
            ]
        };
        
        return bot.sendMessage(chatId, 
            "❌ You're not logged in yet. Please login with GitHub first.",
            { reply_markup: keyboard }
        );
    }
    
    console.log(`Using session token for chat ${chatId}: ${sessionToken}`);
    
    // Show "typing..." indicator
    bot.sendChatAction(chatId, "typing");
    
    try {
        console.log(`Making request to ${SERVER_URL}/github/stats?token=${sessionToken}&chatId=${chatId}`);
        
        const response = await axios.get(`${SERVER_URL}/github/stats?token=${sessionToken}&chatId=${chatId}`);
        
        console.log('Stats response:', response.data);
        
        if (response.data.error) {
            throw new Error(response.data.error);
        }
        
        // Create a more visually appealing stats message
        const statsMessage = 
            "📊 *Your GitHub Profile*\n\n" +
            `👤 *Name:* ${response.data.name || 'Not set'}\n` +
            `📚 *Repositories:* ${response.data.total_repos}\n` +
            `👥 *Followers:* ${response.data.followers}\n` +
            `🔄 *Following:* ${response.data.following}\n`;
        
        // Add contributions if available
        if (response.data.contributions) {
            statsMessage += `🏆 *Contributions:* ${response.data.contributions}\n`;
        }
        
        const keyboard = {
            inline_keyboard: [
                [{ text: "🔄 Refresh Stats", callback_data: "refresh_stats" }],
                [{ text: "📊 View Contributions", callback_data: "view_contributions" }]
            ]
        };
        
        bot.sendMessage(chatId, statsMessage, {
            parse_mode: "Markdown",
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error("Error fetching stats:", error.message);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        }
        
        bot.sendMessage(chatId, 
            `❌ Error fetching your GitHub stats: ${error.message}\n\nPlease try logging in again using /login`
        );
    }
}

// 📚 Help command
bot.onText(/\/help/, (msg) => {
    const helpMessage = 
        "🤖 *GitFolio Bot Commands*\n\n" +
        "• /start - Initialize the bot\n" +
        "• /login - Connect your GitHub account\n" +
        "• /stats - View your GitHub statistics\n" +
        "• /repos - List your repositories\n" +
        "• /contributions - View contribution graph\n" +
        "• /help - Show this help message";
    
    bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: "Markdown" });
});

// Handle contributions view
bot.onText(/\/contributions/, (msg) => {
    handleContributions(msg.chat.id);
});

async function handleContributions(chatId) {
    const sessionToken = userSessions.get(chatId);
    
    if (!sessionToken) {
        return bot.sendMessage(chatId, "❌ Please login first using /login");
    }
    
    bot.sendChatAction(chatId, "typing");
    
    try {
        const response = await axios.get(`${SERVER_URL}/github/contributions?token=${sessionToken}&chatId=${chatId}`);
        
        bot.sendMessage(chatId, 
            `🏆 *Your GitHub Contributions*\n\n` +
            `Total contributions this year: ${response.data.totalContributions}`,
            { parse_mode: "Markdown" }
        );
        
    } catch (error) {
        console.error("Error fetching contributions:", error.message);
        bot.sendMessage(chatId, "❌ Error fetching your contributions. Please try logging in again.");
    }
}

// Add repository listing command
bot.onText(/\/repos/, async (msg) => {
    const chatId = msg.chat.id;
    const sessionToken = userSessions.get(chatId);
    
    if (!sessionToken) {
        return bot.sendMessage(chatId, "❌ Please login first using /login");
    }
    
    bot.sendChatAction(chatId, "typing");
    
    try {
        const response = await axios.get(`${SERVER_URL}/github/repos?token=${sessionToken}&chatId=${chatId}`);
        
        if (!response.data.repos || response.data.repos.length === 0) {
            return bot.sendMessage(chatId, "📚 You don't have any repositories yet.");
        }
        
        let reposMessage = "📚 *Your GitHub Repositories:*\n\n";
        
        response.data.repos.forEach((repo, index) => {
            reposMessage += `${index + 1}. *${repo.name}*\n`;
            if (repo.description) reposMessage += `   ${repo.description}\n`;
            reposMessage += `   ⭐ ${repo.stars} | 🍴 ${repo.forks} | 💻 ${repo.language || 'N/A'}\n\n`;
        });
        
        bot.sendMessage(chatId, reposMessage, { parse_mode: "Markdown" });
        
    } catch (error) {
        console.error("Error fetching repos:", error.message);
        bot.sendMessage(chatId, "❌ Error fetching your repositories. Please try logging in again.");
    }
});

// Debug command to check session info
bot.onText(/\/debug/, (msg) => {
    const chatId = msg.chat.id;
    const sessionToken = userSessions.get(chatId);
    
    let debugInfo = "🔍 *Debug Info*\n\n";
    debugInfo += `Chat ID: \`${chatId}\`\n`;
    debugInfo += `Session Token: ${sessionToken ? `\`${sessionToken}\`` : "Not found"}\n`;
    debugInfo += `Server URL: \`${SERVER_URL}\`\n`;
    
    bot.sendMessage(chatId, debugInfo, { parse_mode: "Markdown" });
});

console.log("🤖 Telegram Bot is running...");