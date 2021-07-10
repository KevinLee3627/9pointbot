const fs = require('fs');
const { ApiClient } = require('twitch');
const { twitchRefreshableAuthProvider, twitchClientCredentialsAuthProvider } = require('./lib/twitchAuth.js');
const { EventSubListener } = require('twitch-eventsub');
const { NgrokAdapter } = require('twitch-eventsub-ngrok');
const { Sheet } = require('google-sheets-simple');
const { getPointsData, updatePointsData } = require('./lib/googleSheets.js');

const logger = require('./lib/logger.js');
const mongo = require('./mongo/mongo.js');
const init_chat = require('./lib/chat.js');
require('dotenv').config();
//in google-sheets-simple, go to /lib/Sheet.js --> ctrl+f "keyFile", make sure path matches /security/sheets_cred.json

async function init() {
	const chat = await init_chat();
	chat.say('granttank', 'YO.');
	const user = await mongo.getUser('granttank9');
	console.log(user);
	await mongo.updateUserPoints('granttank', 1);
	await mongo.disconnect();
	return;
}
init();

async function main() {
	logger('Starting bot.');
	// Initialize google sheets instance
	const sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
	await sheet.initialise();
	let [pointsData, pointsDataRange] = await getPointsData(sheet);
	logger(`Points data retrieved.`);

	//Set up twitch stuff (auth, api clients, eventsub listneer)
	const twitchClientCredentialsAuth = twitchClientCredentialsAuthProvider();
	const twitchApiClient = new ApiClient({ authProvider: twitchClientCredentialsAuth });
	const listener = new EventSubListener(twitchApiClient, new NgrokAdapter(), process.env.TWITCH_EVENTSUB_LISTENER_SECRET);
	await listener.listen();
	const userData = await twitchApiClient.helix.users.getUserByName('granttank');
	const broadcasterId = userData.id;
	// console.log(broadcasterId);
	// Ensures that we don't hit the subscription cap
	await twitchApiClient.helix.eventSub.deleteAllSubscriptions();

	logger(`Beginning chatclient setup`)
	
	// const onlineSubscription = await listener.subscribeToStreamOnlineEvents(broadcasterId, async e => {
	// 	logger(`${e.broadcasterDisplayName} just went live!`)
	// 	// await chatClient.connect();
	// 	chatClient.say(e.broadcasterName, `9pointbot is up and ready for service!`)
	// 	logger('Bot connected to chat!');
	// });
	
	// const offlineSubscription = await listener.subscribeToStreamOfflineEvents(broadcasterId, async e => {
	// 	logger(`${e.broadcasterDisplayName} just went offline`);
	// 	logger(`Users who have received points for the day: ${chatClient.streamPointsReceived}`);
	// 	await chatClient.quit();
	// 	await listener.unlisten();
	// 	logger('Bot disconnected from chat');
	// 	process.exit(0);
	// });

	const userFollowSubscription = await listener.subscribeToChannelFollowEvents(broadcasterId, async e => {
		username = e.userName.toLowerCase();
		logger(`${username} has followed.`);
		
		if (false) {
			// User's first time following - write their name to the log
			mongo.createUser(username);

			//Update google sheets
			// if (!pointsData.has(username)) pointsDataRange = pointsDataRange.slice(0, -1) + String(pointsData.size+2)
			// pointsData = await updatePointsData(username, sheet, pointsData, pointsDataRange, chatClient.pointsRewards.follow);
			// chatClient.say(e.broadcasterName, `!points ${username} can now start earning channel points. +500 for follow.`);
			// logger(`Gave ${username} ${chatClient.pointsRewards.follow} points for following!`);
		} else {
			// User has already followed before!
			logger(`${username} has already followed before. No points awarded.`);
		}
	})

	process.on('SIGINT', () => {
		chatClient.quit();
		listener.unlisten();
		logger('Ctrl-C detected');
		process.exit(0);
	});

}
main();