const mongoose = require('mongoose');
const { User } = require('./schemas.js');
const logger = require('../lib/logger');
const config = require('../config.js');
const { getAllFollowers } = require('../lib/getFollowers.js');
const sheet = require('../lib/GoogleSheet.js');
require('dotenv').config();

class Mongo {
	/**
	 * Creates connection to database.
	 */
	constructor() {
		this.uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@9pointbot-cluster.t1uyx.mongodb.net/?retryWrites=true&w=majority`;
	}
	async connect() {
		logger('Attempting to connect to DB...')
		try {
			this.db = await mongoose.connect(this.uri, {
				dbName: process.env.MONGO_DB_NAME,
				useNewUrlParser: true,
				useUnifiedTopology: true,
				useFindAndModify: false,
				useCreateIndex: true
			});
			logger('Successfully connected to DB!')
		} catch (err) {
			return console.error(err);
		}
	}

	/**
	 * Disconnects from database.
	 */
	async disconnect() {
		logger(`Disconnecting from mongo.`);
		try {
			await mongoose.connection.close();
			logger(`Disconnected from mongo successfully!`)
		} catch (err) {
			console.error(err);
		}
	}

	/**
	 * Gets data for all followers and updates the isFollowing field for
	 * each user in the database. Run on chat init, before the bot connects to chat. 
	 * There is a delay between a user (un)following and the API knowing about it,
	 * so if a user (un)follows a few seconds before the bot starts that change will
	 * not be recognized in the DB.
	 */
	async updateFollowingStatus() {
		// TODO: Relook at the logic for this. What happens if someone follows when stream is offline?
		// Shouldn't a new User object be made?
		const allFollowers = (await getAllFollowers(config.broadcaster.id)).map(follower => follower.user.name);
		console.log(`Total followers: ${allFollowers.length}`);
		
		const filter_unfollowed = { username: { $nin: allFollowers } };
		const update_unfollowed = { isFollowing: false }
		await User.updateMany(filter_unfollowed, update_unfollowed);

		const filter_followed = { username: { $in: allFollowers }};
		const update_followed = { isFollowing: true }
		await User.updateMany(filter_followed, update_followed);
		logger(`Completed updating the following status of all users since last stream.`);
	}

	/**
	 * Creates a user in the database IF the user does not exist.
	 * Uniqueness is enforced by the User schema (username field must be unique)
	 * @param {String} username
	 */
	async createUser(username, isFollowing) {
		// Users are created once they FOLLOW and thus are eligible to earn points.
		const userInstance = new User({
			username,
			points: config.pointRewards.follow,
			lastMessageTimestamp: Date.now(),
			isFollowing,
			hasFollowed: true
		});
		await userInstance.save((err, user) => {
			if (err && err.code === 11000) logger(`ERROR: ${username} already exists in DB.`);
			else console.error(err);
		});
	}

	/**
	 * Sets a user's points to a certain value.
	 * @param {String} username
	 * @param {Number} points 
	 */
	async updateUserPoints(username, points) {
		logger('Updating points for '+username);
		const query = { username };
		const update = { points };
		const options = { new: true }
		await User.findOneAndUpdate(query, update, options, (err, user) => {
			if (err) return console.error(err);
		});
		// Update the google sheets at the same time. Bundling both together in same function
		// stops me from making dumbass mistakes during development
		await sheet.updateSheet(username, points);
	}

	/**
	 * Updates the user's lastMessageTimestamp to current Unix timestamp
	 * This should only be updated when enough time has elapsed to earn more points!
	 * @param {String} username 
	 */
	async updateUserTimestamp(username) {
		const filter = { username };
		const update = { lastMessageTimestamp: Date.now() };
		await User.updateOne(filter, update, (err, res) => {
			if (err) return console.error(err);
		});
	}

	/**
	 * Toggles user's isFollowing status.
	 * Not actually used?
	 * TODO: figure out why this function exists
	 * @param {String} username 
	 */
	async updateUserFollowingStatus(username, bool) {
		const filter = { username };
		const update = { isFollowing: bool };
		await User.updateOne(filter, update, (err, res) => {
			if (err) return console.error(err);
		})
	}

	/**
	 * Searchs DB for user and returns one if found
	 * @param {String} username 
	 * @returns {Object} User document
	 */
	async getUser(username) {
		const filter = { username }
		return await User.findOne(filter).exec();
	}
}

const mongo = new Mongo();

module.exports = mongo;