const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		unique: true,
		required: true
	},
	points: Number,
	lastMessageTimestamp: Number,
	isFollowing: Boolean,
	hasFollowed: Boolean,
	poolTopic: String
})

const User = mongoose.model('user', userSchema);

module.exports = { User }