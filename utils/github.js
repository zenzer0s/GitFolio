// utils/github.js
const axios = require('axios');

/**
 * Fetches basic user profile data from GitHub
 */
async function fetchUserProfile(githubToken, username) {
  try {
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${githubToken}` }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error fetching GitHub profile:", error.message);
    throw new Error(`Failed to fetch GitHub profile: ${error.message}`);
  }
}

/**
 * Fetches user's contributions using GitHub GraphQL API
 */
async function fetchContributions(githubToken) {
  const graphqlQuery = {
    query: `
      query {
        viewer {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `
  };

  try {
    const response = await axios.post(
      "https://api.github.com/graphql",
      graphqlQuery,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );

    return response.data.data.viewer.contributionsCollection.contributionCalendar;
  } catch (error) {
    console.error("Error fetching GitHub contributions:", error.message);
    throw new Error(`Failed to fetch GitHub contributions: ${error.message}`);
  }
}

/**
 * Fetches user's repositories
 */
async function fetchRepositories(githubToken, limit = 5) {
  try {
    const response = await axios.get(`https://api.github.com/user/repos?sort=updated&per_page=${limit}`, {
      headers: { Authorization: `Bearer ${githubToken}` }
    });
    
    return response.data.map(repo => ({
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url
    }));
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error.message);
    throw new Error(`Failed to fetch GitHub repositories: ${error.message}`);
  }
}

/**
 * Get GitHub access token from OAuth code
 */
async function getAccessToken(code) {
  try {
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, { 
      headers: { Accept: 'application/json' } 
    });

    return tokenRes.data.access_token;
  } catch (error) {
    console.error("Error getting GitHub access token:", error.message);
    throw new Error(`Failed to get GitHub access token: ${error.message}`);
  }
}

/**
 * Combine user data for stats response
 */
async function getUserStats(githubToken, username) {
  try {
    const [profileData, contributionsData] = await Promise.all([
      fetchUserProfile(githubToken, username),
      fetchContributions(githubToken)
    ]);
    
    return {
      name: profileData.name || profileData.login,
      total_repos: profileData.public_repos,
      followers: profileData.followers,
      following: profileData.following,
      contributions: contributionsData.totalContributions,
      avatar_url: profileData.avatar_url
    };
  } catch (error) {
    console.error("Error getting user stats:", error.message);
    throw error;
  }
}

module.exports = {
  fetchUserProfile,
  fetchContributions,
  fetchRepositories,
  getAccessToken,
  getUserStats
};