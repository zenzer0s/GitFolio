require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const axios = require('axios');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Store user chat IDs for scheduled messages
let users = new Set();

// Handle "/start" command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    users.add(chatId);
    
    bot.sendMessage(chatId, "🚀 Welcome to GitFolio Bot!\n\nGet daily GitHub stats in Telegram!", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📅 Today’s Stats", callback_data: "stats_today" }],
                [{ text: "📆 Weekly Stats", callback_data: "stats_week" }],
                [{ text: "📊 Monthly Stats", callback_data: "stats_month" }],
                [{ text: "🏆 All-time Stats", callback_data: "stats_all" }]
            ]
        }
    });
});

// Function to fetch GitHub stats
async function fetchGitHubStats() {
    try {
        const response = await axios.get('http://localhost:3000/github/contributions');
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching GitHub stats:", error);
        return { error: "Failed to fetch GitHub stats" };
    }
}

// Handle inline button clicks
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    const stats = await fetchGitHubStats();

    let message = "❌ Failed to fetch stats.";
    if (!stats.error) {
        if (data === "stats_today") {
            message = `📅 *Today's Contributions:* ${stats.today}`;
        } else if (data === "stats_week") {
            message = `📆 *This Week:* ${stats.week}`;
        } else if (data === "stats_month") {
            message = `📊 *This Month:* ${stats.month}`;
        } else if (data === "stats_all") {
            message = `🏆 *All-time Contributions:* ${stats.totalContributions}`;
        }
    }
    
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
});

// Schedule messages at 8 AM & 10 PM
cron.schedule("0 8 * * *", async () => {
    console.log("📨 Sending 8 AM updates...");
    for (const chatId of users) {
        const stats = await fetchGitHubStats();
        bot.sendMessage(chatId, `☀️ *Good Morning!*\n📅 Today's Contributions: ${stats.today || "N/A"}`, { parse_mode: "Markdown" });
    }
});

cron.schedule("0 22 * * *", async () => {
    console.log("📨 Sending night updates...");
    for (const chatId of users) {
        const stats = await fetchGitHubStats();
        bot.sendMessage(chatId, `🌙 *Good Night!*\n📅 Today's Contributions: ${stats.today || "N/A"}`, { parse_mode: "Markdown" });
    }
});

console.log("🤖 Telegram bot is running...");
