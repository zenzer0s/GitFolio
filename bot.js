require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const SERVER_URL = process.env.SERVER_URL;

const users = new Map(); // Stores user sessions

// 🛠 Handle "/start"
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🚀 Welcome to GitFolio Bot!\n\nUse /login to authenticate with GitHub.");
});

// 🔑 Handle "/login"
bot.onText(/\/login/, (msg) => {
    const chatId = msg.chat.id;
    const loginUrl = `${SERVER_URL}/auth/github`;
    
    bot.sendMessage(chatId, "🔗 Click the link below to login with GitHub:\n\n" + loginUrl);
});

// 📊 Fetch Stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const response = await axios.get(`${SERVER_URL}/github/stats`, { withCredentials: true });

        bot.sendMessage(chatId, `📊 *GitHub Stats:*\n👤 Name: ${response.data.name}\n📁 Repos: ${response.data.total_repos}\n👥 Followers: ${response.data.followers}\n🔄 Following: ${response.data.following}`, {
            parse_mode: "Markdown"
        });

    } catch (error) {
        bot.sendMessage(chatId, "❌ Error: Please login first using /login.");
    }
});

console.log("🤖 Telegram Bot is running...");
