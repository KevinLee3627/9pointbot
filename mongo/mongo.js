const mongoose = require('mongoose');
const { User } = require('./schemas.js');
const logger = require('../lib/logger');
const config = require('../config.js');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@9pointbot-cluster.t1uyx.mongodb.net/?retryWrites=true&w=majority`;
class Mongo {
	/**
	 * Creates connection to database.
	 */
	async connect() {
		logger('Attempting to connect to DB...')
		try {
			this.db = await mongoose.connect(uri, {
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
	 * // TODO: finish this function
	 * @param {String} test 
	 */
	async updateFollowingStatus(test) {
		// Run getAllFollowers - look through DB to see which users are missing from
		// the getAllFollowers username array. If the username is not in the DB anymore,
		// Change the isFollowing status to false.
		// Log everyone who has had their status change
	}

	/**
	 * Creates a user in the database IF the user does not exist.
	 * Uniqueness is enforced by the User schema (username field must be unique)
	 * @param {String} username Username of user that will be inserted into DB
	 */
	async createUser(username) {
		// Users are created once they FOLLOW and thus are eligible to earn points.
		const userInstance = new User({
			username,
			points: config.followPoints,
			lastMessageTimestamp: Date.now(),
			isFollowing: true,
			hasFollowed: true
		});
		await userInstance.save((err, user) => {
			if (err && err.code === 11000) logger(`ERROR: ${username} already exists in DB.`);
			else console.error(err);
			logger(`Created user: ${username}`);
		})
	}

	/**
	 * 
	 * @param {String} username Username of user that will be updated
	 * @param {Number} pointsDelta Integer value of points given/taken
	 */
	async updateUserPoints(username, pointsDelta) {
		logger('Updating points for '+username)
		const query = { username: username };
		const update = { $inc: { points: pointsDelta } };
		const options = { new: true }
		await User.findOneAndUpdate(query, update, options, (err, user) => {
			if (err) return console.error(err);
		});
	}

	/**
	 * Updates the user's lastMessageTimestamp to current Unix timestamp
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
	 * @param {String} username 
	 */
	async updateUserFollowingStatus(username) {
		const filter = { username };
		const result = await User.findOne(filter).exec();
		const update = { isFollowing: !result.isFollowing };
		await User.updateOne(filter, update, (err, res) => {
			if (err) return console.error(err);
		})
	}

	async getUser(username) {
		User.findOne({ username }, (err, user) => {
			if (err) return console.error(err);
			console.log(user);
		})
	}

}
module.exports = new Mongo();