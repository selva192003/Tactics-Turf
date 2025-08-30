const axios = require('axios');

// This URL is for cricket on Sportmonks.
// Replace this with the URL for your chosen sports API.
const SPORTS_API_URL = 'https://api.sportmonks.com/v3/cricket/';
const apiKey = process.env.SPORTS_API_KEY;

const getUpcomingMatches = async () => {
    try {
        // This endpoint might be different for your chosen API.
        // Check the documentation of your sports API provider.
        const response = await axios.get(`${SPORTS_API_URL}fixtures?api_token=${apiKey}&include=runs`);
        return response.data;
    } catch (error) {
        console.error('Error fetching upcoming matches:', error.message);
        return null;
    }
};

module.exports = {
    getUpcomingMatches,
};