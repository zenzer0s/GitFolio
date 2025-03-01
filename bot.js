require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Start Command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Welcome to GitFolio! Connect your GitHub to track your contributions.", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔗 Connect GitHub", url: `${process.env.BASE_URL}/auth/github` }]
            ]
        }
    });
});

// Placeholder for Stats Command
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "📊 Select stats type:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📌 Today", callback_data: "stats_today" }],
                [{ text: "📆 Weekly", callback_data: "stats_weekly" }],
                [{ text: "📅 Monthly", callback_data: "stats_monthly" }],
                [{ text: "📊 All-Time", callback_data: "stats_alltime" }]
            ]
        }
    });
});

// Placeholder for handling inline button clicks
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    switch (query.data) {
        case "stats_today":
            bot.sendMessage(chatId, "📌 Today's Stats: [Fetching...]");
            break;
        case "stats_weekly":
            bot.sendMessage(chatId, "📆 Weekly Stats: [Fetching...]");
            break;
        case "stats_monthly":
            bot.sendMessage(chatId, "📅 Monthly Stats: [Fetching...]");
            break;
        case "stats_alltime":
            bot.sendMessage(chatId, "📊 All-Time Stats: [Fetching...]");
            break;
    }
    bot.answerCallbackQuery(query.id);
});

console.log("🤖 GitFolio Bot is running...");
