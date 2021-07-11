const fs = require('fs');
const { twitchRefreshableAuthProvider } = require('./twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const mongo = require('../mongo/Mongo.js');
const config = require('../config.js');
const logger = require('./logger.js');

async function initChat() {
	const shouldIgnore = user => ['9pointbot', 'nightbot', 'wizebot'].includes(user);
	
	const chatClient = new ChatClient(await twitchRefreshableAuthProvider(), { channels: ['granttank'] });
	chatClient.passivePointsReceived = [];
	chatClient.channel = config.broadcaster.name;

	// Initialize commands
	chatClient.commands = new Map();
	const commandFiles = fs.readdirSync(__dirname + '/../commands').filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`../commands/${file}`);
		chatClient.commands.set(command.name, command);
	}

	await chatClient.connect(); //REMOVE IN PRODUCTION

	chatClient.onRegister( () => {
		chatClient.say(config.broadcaster.name, '9pointbot is fully initialized! peepoHey');
	})
	
	chatClient.onMessage(async (channel, username, msg, fullMsg) => {
		if (shouldIgnore(username)) return;
		
		// Command handling
		if (msg.startsWith(config.prefix)) {
			const [commandName, ...args] = msg.slice(1).split(' ');
			const command = chatClient.commands.get(commandName);
			if (!command) return;
			try {
				await command.execute(chatClient, args, username);
			} catch (err) {
				console.log(err);
				chatClient.say(config.broadcaster.name, 'There was an error executing that command.');
			}
			return;
		}

		// If user is not followed/has not followed they will not be in DB, so don't go through rest of logic
		const user = await mongo.getUser(username);
		// Check for broadcaster here b/c broadcaster should still be able to use commands
		if (!user || username === config.broadcaster.name) return;

		const receivedPassivePoints = chatClient.passivePointsReceived.includes(username);
		
		logger(`[${channel}] [Following: ${user.isFollowing} | Received Points: ${receivedPassivePoints}] ${username}: ${msg}`);
		if (user.isFollowing && !receivedPassivePoints) {
			const newPointsValue = user.points + config.pointRewards.firstMessage;
			await mongo.updateUserPoints(username, newPointsValue);
			chatClient.passivePointsReceived.push(username);
			return chatClient.say(config.broadcaster.name, `${username} +${config.pointRewards.firstMessage} passive points earned for this stream (Total: ${newPointsValue})`);
		}
		

		if (user.isFollowing && receivedPassivePoints) {
			// The logger function seems to be weird with its timestamps? 
			// const currentTimestamp = Date.now();
			// console.log(currentTimestamp - user.lastMessageTimestamp);
			// if (currentTimestamp - user.lastMessageTimestamp > config.watchPointsTime) {
			// 	console.log(`It has been at least 6 secnds since your last message`);
			// 	const newPointsValue = user.points + config.pointRewards.watch;
			// 	await mongo.updateUserTimestamp(username);
			// 	await mongo.updateUserPoints(username, newPointsValue);
			// 	return chatClient.say(channel, `@${username} +${config.pointRewards.watch} points earned (Total: ${newPointsValue}).`)
			// }
		}

	});
	return chatClient;
}

module.exports = initChat;