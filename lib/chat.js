const { twitchRefreshableAuthProvider } = require('./twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const { getAllFollowers } = require ('./getFollowers.js');


async function init_chat() {
	const shouldIgnore = (user) => ['9pointbot', 'nightbot', '9hournap', 'wizebot'].includes(user);
	const twitchOAuth = await twitchRefreshableAuthProvider();
	const chatClient = new ChatClient(twitchOAuth, { channels: ['granttank'] });
	await chatClient.connect(); //REMOVE IN PRODUCTION
	// chatClient.followers = (await getAllFollowers(process.env.BROADCASTER_ID)).map(follower => follower.user.name);
	// chatClient.streamPointsReceived = [];
	// chatClient.usersThatGambled = [];
	// chatClient.pointsRewards = {
	// 	'firstMessage': 500,
	// 	'follow': 500
	// }
	
	chatClient.onMessage(async (channel, username, msg, fullMsg) => {
		username = fullMsg.userInfo.userName.toLowerCase(); //everything should be done in lowercase to be careful
	
		if (shouldIgnore(username)) return;
	
		// const isFollowing = chatClient.followers.includes(username);
		// const receivedPassivePoints = chatClient.streamPointsReceived.includes(username);
		logger(`[${channel}] [Following: ${isFollowing} | Received Points: ${receivedPassivePoints}] ${username}: ${msg}`);
	
		if (isFollowing && !receivedPassivePoints) {
			// Adds new users to data object if they have never gotten points before
			if (!pointsData.has(username)) {
				pointsDataRange = pointsDataRange.slice(0, -1) + String(pointsData.size+2); //+1 for header, +1 for extending another row
			}
			pointsData = await updatePointsData(username, sheet, pointsData, pointsDataRange, chatClient.pointsRewards.firstMessage);
			chatClient.streamPointsReceived.push(username);
			chatClient.say(channel, `${username} +500 passive points earned for this stream`);
		}
	});
	return chatClient;
}

module.exports = init_chat;