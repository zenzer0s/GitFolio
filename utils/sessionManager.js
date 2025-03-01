// Add to utils/sessionManager.js
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Store session
exports.storeSession = async (token, sessionData) => {
  return client.set(token, JSON.stringify(sessionData));
};

// Retrieve session
exports.getSession = async (token) => {
  const data = await client.get(token);
  return data ? JSON.parse(data) : null;
};