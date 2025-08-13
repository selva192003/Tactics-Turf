const admin = require('firebase-admin');

// Check if the Firebase Admin SDK is already initialized
if (admin.apps.length === 0) {
    try {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('Error initializing Firebase Admin SDK:', error);
    }
}

module.exports = admin;