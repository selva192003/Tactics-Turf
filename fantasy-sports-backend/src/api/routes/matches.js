const express = require('express');
const router = express.Router();
const { getUpcomingMatches } = require('../../services/sportsApi');
router.get('/upcoming', async (req, res) => {
    try {
        const matches = await getUpcomingMatches();
        res.json(matches);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error fetching upcoming matches.' });
    }
});
module.exports = router;