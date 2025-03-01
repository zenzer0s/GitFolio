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

/**
 * Calculates user's contribution streak data
 * Returns current streak, longest streak, etc.
 */
async function getStreakData(githubToken) {
  try {
    const contributionsData = await fetchContributions(githubToken);
    const contributionDays = [];
    
    // Flatten the weeks array to get all contribution days
    contributionsData.weeks.forEach(week => {
      week.contributionDays.forEach(day => {
        contributionDays.push(day);
      });
    });
    
    // Sort by date (newest first)
    contributionDays.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    
    // Calculate today's contributions
    const todayData = contributionDays.find(day => day.date === todayFormatted) || { contributionCount: 0 };
    const todayContributions = todayData.contributionCount;
    
    // Calculate current streak
    let currentStreak = 0;
    let i = 0;
    
    // If today has contributions, include it in the streak
    if (todayContributions > 0) {
      currentStreak = 1;
      i = 1; // Start checking from yesterday
    }
    
    // Check previous days
    while (i < contributionDays.length - 1) {
      const currentDate = new Date(contributionDays[i].date);
      const prevDate = new Date(contributionDays[i + 1].date);
      
      // Check if dates are consecutive (1 day difference)
      const dayDifference = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (dayDifference !== 1 || contributionDays[i + 1].contributionCount === 0) {
        break;
      }
      
      currentStreak++;
      i++;
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    let currentLongestStreak = 0;
    
    for (let i = 0; i < contributionDays.length - 1; i++) {
      if (contributionDays[i].contributionCount > 0) {
        currentLongestStreak++;
        
        // Check if this is the end of a streak (next day has no contributions or is not consecutive)
        const currentDate = new Date(contributionDays[i].date);
        const nextDate = new Date(contributionDays[i + 1].date);
        const dayDifference = Math.round((currentDate - nextDate) / (1000 * 60 * 60 * 24));
        
        if (dayDifference !== 1 || contributionDays[i + 1].contributionCount === 0) {
          // End of streak
          longestStreak = Math.max(longestStreak, currentLongestStreak);
          currentLongestStreak = 0;
        }
      } else {
        currentLongestStreak = 0;
      }
    }
    
    // Check the last day
    if (contributionDays[contributionDays.length - 1]?.contributionCount > 0) {
      currentLongestStreak++;
    }
    
    longestStreak = Math.max(longestStreak, currentLongestStreak);
    
    return {
      currentStreak,
      longestStreak,
      totalContributions: contributionsData.totalContributions,
      todayContributions,
      contributionDays
    };
  } catch (error) {
    console.error("Error calculating streak data:", error.message);
    throw new Error(`Failed to calculate streak data: ${error.message}`);
  }
}

/**
 * Generates a URL for the user's GitHub contribution/streak graph
 * Uses GitHub Readme Stats API
 */
function getStreakGraphUrl(username) {
  return `https://github-readme-streak-stats.herokuapp.com/?user=${username}&theme=dark&hide_border=true`;
}

/**
 * Get user's stats for a specific time period (today, weekly, monthly, alltime)
 */
async function getStatsByPeriod(githubToken, username, period = 'today') {
  try {
    const [streakData, repos] = await Promise.all([
      getStreakData(githubToken),
      fetchRepositories(githubToken, 10)
    ]);
    
    const contributionDays = streakData.contributionDays;
    
    let startDate;
    const today = new Date();
    
    // Determine the start date based on period
    switch (period) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        break;
      case 'alltime':
      default:
        startDate = null; // No start date limit for all-time
        break;
    }
    
    // Filter contributions by date if needed
    const filteredDays = startDate 
      ? contributionDays.filter(day => new Date(day.date) >= startDate)
      : contributionDays;
    
    // Calculate total commits in the period
    const totalCommits = filteredDays.reduce((total, day) => total + day.contributionCount, 0);
    
    // For today, get detailed repository info
    let repoStats = [];
    if (period === 'today') {
      // This is a simplification - in a real app, you'd need to fetch commits per repo
      // For this example, we'll randomly distribute today's commits among recent repos
      const todayCommits = streakData.todayContributions;
      
      if (todayCommits > 0 && repos.length > 0) {
        // Take up to 3 recent repos
        const activeRepos = repos.slice(0, 3);
        
        // Distribute commits
        let remainingCommits = todayCommits;
        repoStats = activeRepos.map((repo, index) => {
          const isLast = index === activeRepos.length - 1;
          const repoCommits = isLast ? remainingCommits : Math.max(1, Math.floor(remainingCommits / (activeRepos.length - index)));
          remainingCommits -= repoCommits;
          
          return {
            name: repo.name,
            commits: repoCommits
          };
        });
      }
      
      // Simulate coding time (this would need actual tracking in a real app)
      const codingTime = todayCommits > 0 ? `${Math.floor(todayCommits * 0.5 + Math.random() * 2)} hours` : 'None';
      
      return {
        commits: todayCommits,
        repos: repoStats,
        codingTime,
        currentStreak: streakData.currentStreak
      };
    }
    
    // For other periods
    return {
      commits: totalCommits,
      activeRepos: repos.length,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      totalContributions: streakData.totalContributions
    };
  } catch (error) {
    console.error(`Error getting ${period} stats:`, error.message);
    throw new Error(`Failed to get ${period} stats: ${error.message}`);
  }
}

/**
 * Fetches commit activity for a specific repository
 */
async function fetchRepoCommitActivity(githubToken, owner, repo) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    
    return response.data;
  } catch (error) {
    console.error("Error fetching repo commit activity:", error.message);
    throw new Error(`Failed to fetch repo commit activity: ${error.message}`);
  }
}

/**
 * Generates GitHub streak graph URL using GitHub Readme Stats
 */
function generateStreakGraph(username) {
  const baseUrl = 'https://github-readme-streak-stats.herokuapp.com/';
  const params = new URLSearchParams({
    user: username,
    theme: 'dark',
    hide_border: true,
    date_format: 'M j[, Y]'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generates GitHub contribution graph URL using GitHub Readme Stats
 */
function generateContributionGraph(username) {
  return `https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&count_private=true&theme=dark&hide_border=true`;
}

module.exports = {
  fetchUserProfile,
  fetchContributions,
  fetchRepositories,
  getAccessToken,
  getUserStats,
  getStreakData,
  getStreakGraphUrl,
  getStatsByPeriod,
  fetchRepoCommitActivity,
  generateStreakGraph,
  generateContributionGraph
};