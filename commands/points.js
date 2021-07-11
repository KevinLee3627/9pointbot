const config = require('../config');
const logger = require('../lib/logger');
const mongo = require('../mongo/Mongo');

module.exports = {
	name: 'points',
	async execute(chatClient, args, msgSender) {
		console.log(args);
		if (args.length === 0) {
			chatClient.say(config.broadcaster.name, `https://docs.google.com/spreadsheets/d/11X6rQhVxVI_VJLn63VoohkKW_qjvGvdTzv2tVrIpqaI/edit?usp=sharing`);
		}
	}
}