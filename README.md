
---

### **GitFolio - Your GitHub Stats on Telegram**  

🚀 **GitFolio** is a Telegram bot that fetches and delivers your GitHub stats, including daily contributions, streaks, and repository details, right to your chat!  

### **Features**  
✅ **GitHub OAuth Login** – Secure authentication via GitHub.  
✅ **Daily & Nightly Stats** – Get your GitHub contributions at 8 AM & before bed.  
✅ **Inline Commands** – Fetch all-time, monthly, weekly, and today's stats.  
✅ **Simple & Fast Setup** – No database required, just login and start.  

---

### **Setup & Installation**  

#### **1️⃣ Clone the Repository**  
```bash
git clone https://github.com/zenzer0s/GitFolio.git
cd GitFolio
```

#### **2️⃣ Install Dependencies**  
```bash
npm install
```

#### **3️⃣ Create a `.env` File**  
```bash
cp .env.example .env
```
Fill in the required credentials for **GitHub OAuth** and **Telegram Bot Token**.  

#### **4️⃣ Start the Server & Bot**  
```bash
node server.js
node bot.js
```

---

### **Usage**  

#### **1️⃣ Start Bot & Authenticate**  
- Open Telegram and start the bot.  
- Send `/login` to authenticate with GitHub.  

#### **2️⃣ Fetch Stats**  
- `/stats` → Get your latest GitHub contribution stats.  
- Inline buttons for **Today**, **Weekly**, **Monthly**, and **All-time stats**.  

#### **3️⃣ Automatic Daily Updates**  
- At **8 AM** → Morning GitHub stats delivered.  
- Before **bedtime** → Daily contribution summary.  

---

### **Tech Stack**  
- **Node.js** (Express for the backend)  
- **Telegraf.js** (Telegram bot framework)  
- **GitHub GraphQL API**  

---

### **To-Do & Future Features**  
🚀 **Custom Time Alerts** – Let users set their own stat update times.  
🚀 **More Stats** – Track top repositories, stars, and pull requests.  
🚀 **Multi-user Support** – Expand bot usability for public use.  

---

### **Contributing**  
Got ideas? Feel free to open issues or PRs! 😃  

---

🔥 **Developed by [Praveen Zalaki](https://github.com/zenzer0s) 🚀**  

---

Let me know if you want to tweak anything! 💡