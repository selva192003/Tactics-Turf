const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, 'Please enter a valid email address']
  },
  username: {
    type: String,
    trim: true,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: 'https://i.pravatar.cc/150'
  },
  bio: {
    type: String,
    default: ''
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  achievements: [{
    type: String
  }],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;