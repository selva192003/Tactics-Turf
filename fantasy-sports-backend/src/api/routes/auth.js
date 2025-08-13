const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const admin = require('../../config/firebase');
const User = require('../../models/User'); // Path should be correct now

// @route   POST /api/auth/login
// @desc    Authenticate user with Firebase token and return JWT
// @access  Public
router.post('/login', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ msg: 'No token provided.' });
    }

    try {
        // Verify Firebase ID token with Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { uid, email } = decodedToken;

        // Find or create user in MongoDB
        let user = await User.findOne({ firebaseId: uid });

        if (!user) {
            // If user doesn't exist, create a new one
            user = new User({
                firebaseId: uid,
                email,
                username: email.split('@')[0], // Simple username for now
            });
            await user.save();
            console.log(`New user created: ${user.email}`);
        }

        // Create and sign a JSON Web Token for our application session
        const payload = {
            user: {
                id: user.id
            }
        };

        const jwtToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({ token: jwtToken, user });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server Error: Token verification failed.' });
    }
});

module.exports = router;