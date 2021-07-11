const { twitchRefreshableAuthProvider } = require('./twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const { getPointsData, updatePointsData } = require('./googleSheets.js');
const { getAllFollowers } = require ('./getFollowers.js');
const mongo = require('../mongo/mongo.js');
const sheet = require('./googleSheets.js');
const config = require('../config.js');
const logger = require('./logger.js');

async function init_chat() {
	const shouldIgnore = user => ['9pointbot', 'nightbot', '9hournap', 'wizebot'].includes(user);
	const twitchOAuth = await twitchRefreshableAuthProvider();
	const chatClient = new ChatClient(twitchOAuth, { channels: ['granttank'] });
	chatClient.followers = (await getAllFollowers(config.broadcaster.id)).map(follower => follower.user.name);
	chatClient.passivePointsReceived = [];
	await chatClient.connect(); //REMOVE IN PRODUCTION

	chatClient.onRegister( () => {
		chatClient.say(config.broadcaster.name, '9pointbot is fully initialized! peepoHey')
	})
	
	chatClient.onMessage(async (channel, username, msg, fullMsg) => {
		const user = await mongo.getUser(username);
		// User should only be created when they follow - not when they chat for the first time!
		if (!user) return;
		if (shouldIgnore(username)) return;
		
		const receivedPassivePoints = chatClient.passivePointsReceived.includes(username);
		
		logger(`[${channel}] [Following: ${user.isFollowing} | Received Points: ${receivedPassivePoints}] ${username}: ${msg}`);
		if (user.isFollowing && !receivedPassivePoints) {

			await mongo.updateUserPoints(username, user.points+config.streamPassivePoints);
			await sheet.updateSheet(username, user.points+config.streamPassivePoints);
			chatClient.passivePointsReceived.push(username);
			return chatClient.say(channel, `${username} +${config.streamPassivePoints} passive points earned for this stream`);
		}
		

		if (user.isFollowing && receivedPassivePoints) {
			//TODO: Check if it has been 30 minutes since the last message
			// The loggeer function seems to be off? 
			const currentTimestamp = Date.now();
			console.log(currentTimestamp - user.lastMessageTimestamp);
			if (currentTimestamp - user.lastMessageTimestamp > 1000 * 60 * 0.1) {
				console.log(`It has been at least 6 secnds since your last message`);
				await mongo.updateUserTimestamp(username);
				await mongo.updateUserPoints(username, user.points+config.watchPoints);
				await sheet.updateSheet(username, user.points+config.watchPoints);
				chatClient.say(channel, `@${username} +${config.watchPoints} points earned - it has been over 6 seconds since your last message!`)
			}
			//END TODO
		}

	});
	return chatClient;
}

module.exports = init_chat;