const config = require('../config');
const logger = require('../lib/logger');
const mongo = require('../mongo/Mongo');

module.exports = {
	name: 'points',
	async execute(chatClient, args, msgSender) {
		if (args.length === 0) {
			try {
				const user = await mongo.getUser(msgSender);
				chatClient.say(config.broadcaster.name, `You have ${user.points} points. ${config.sheetLink}`);
			} catch (err) {
				console.log(err);
				chatClient.say(config.broadcaster.name, `There was an error executing this command.`)
			}
		}
	}
}