const { poolTopics, broadcaster } = require('../config');
const logger = require('../lib/logger');
const mongo = require('../mongo/Mongo');

module.exports = {
	name: 'pool',
	async execute(chatClient, args, msgSender) {
		if (args.length === 0) {
			return chatClient.say(broadcaster.name, `Type !pool <option> to use this command. The available options to pool are: ${poolTopics.join(', ')}.`);
		} else {
			const [ poolTopicInput ] = args;
			if (!poolTopics.includes(poolTopicInput)) {
				return chatClient.say(broadcaster.name, `${msgSender} has chosen an invalid pool. The available options to pool are: ${poolTopics.join(', ')}.`)
			} 
			if ( poolTopicInput === 'none') {
				await mongo.updateUser(msgSender, 'poolTopic', '');
				return chatClient.say(broadcaster.name, `${msgSender} has removed their points from pooling.`);
			}

			const user = await mongo.getUser(msgSender);
			if (!user) return chatClient.say(broadcaster.name, `User "${msgSender}" does not exist in DB.`);
			if (!user.isFollowing) return;

			logger(user.username, user?.poolTopicInput, poolTopicInput);
			await mongo.updateUser(msgSender, 'poolTopic', poolTopicInput);
			return chatClient.say(broadcaster.name, `${msgSender} has successfully pooled their points to ${poolTopicInput}`);
		}
	}
}