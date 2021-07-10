const fs = require('fs');
const { ApiClient } = require('twitch');
const { twitchRefreshableAuthProvider, twitchClientCredentialsAuthProvider } = require('./lib/twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const { EventSubListener } = require('twitch-eventsub');
const { NgrokAdapter } = require('twitch-eventsub-ngrok');
const { Sheet } = require('google-sheets-simple');
const { getPointsData, updatePointsData } = require('./lib/googleSheets.js');
const { getAllFollowers } = require ('./lib/getFollowers.js');
const logger = require('./lib/logger.js');
const mongo = require('./mongo/mongo.js');
require('dotenv').config();
//in google-sheets-simple, go to /lib/Sheet.js --> ctrl+f "keyFile", make sure path matches /security/sheets_cred.json

async function init() {
	await mongo.connect();
	await mongo.updateUserPoints('granttank', 1);
	await mongo.disconnect();
	return;
}
init();

const shouldIgnore = (user) => ['9pointbot', 'nightbot', '9hournap', 'wizebot'].includes(user);
async function main() {
	logger('Starting bot.');
	// Initialize google sheets instance
	const sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
	await sheet.initialise();
	let [pointsData, pointsDataRange] = await getPointsData(sheet);
	logger(`Points data retrieved.`);

	//Set up twitch stuff (auth, api clients, eventsub listneer)
	const twitchOAuth = await twitchRefreshableAuthProvider();
	const twitchClientCredentialsAuth = twitchClientCredentialsAuthProvider();
	const twitchApiClient = new ApiClient({ authProvider: twitchClientCredentialsAuth });
	const listener = new EventSubListener(twitchApiClient, new NgrokAdapter(), process.env.TWITCH_EVENTSUB_LISTENER_SECRET);
	await listener.listen();
	// const userData = await twitchApiClient.helix.users.getUserByName('granttank');
	// const broadcasterId = userData.id;
	// console.log(broadcasterId);
	// Ensures that we don't hit the subscription cap
	await twitchApiClient.helix.eventSub.deleteAllSubscriptions();

	logger(`Beginning chatclient setup`)
	const chatClient = new ChatClient(twitchOAuth, { channels: ['granttank'] });
	await chatClient.connect(); //REMOVE IN PRODUCTION
	chatClient.followers = (await getAllFollowers(broadcasterId)).map(follower => follower.user.name);
	chatClient.commands = {}
	chatClient.streamPointsReceived = [];
	chatClient.usersThatGambled = [];
	chatClient.pointsRewards = {
		'firstMessage': 500,
		'follow': 500
	}
	
	chatClient.onMessage(async (channel, username, msg, fullMsg) => {
		username = fullMsg.userInfo.userName.toLowerCase(); //everything should be done in lowercase to be careful

		if (shouldIgnore(username)) return;

		if (msg === '!bot') {
			return chatClient.say(channel, '9pointbot automatically distributes points for talking (once per stream) and following (once per life). Made by Granttank, DM him or bug the streamer to bug me if there are any issues. Currently a work in progress!');
		}
		if (msg === '!granttank') {
			return chatClient.say(channel, 'EZ the streamer won\'t take your money, but I will! venmo: kevinnivekkevin');
		}

		const isFollowing = chatClient.followers.includes(username);
		const receivedPassivePoints = chatClient.streamPointsReceived.includes(username);
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
	const onlineSubscription = await listener.subscribeToStreamOnlineEvents(broadcasterId, async e => {
		logger(`${e.broadcasterDisplayName} just went live!`)
		// await chatClient.connect();
		chatClient.say(e.broadcasterName, `9pointbot is up and ready for service!`)
		logger('Bot connected to chat!');
	});
	
	const offlineSubscription = await listener.subscribeToStreamOfflineEvents(broadcasterId, async e => {
		logger(`${e.broadcasterDisplayName} just went offline`);
		logger(`Users who have received points for the day: ${chatClient.streamPointsReceived}`);
		await chatClient.quit();
		await listener.unlisten();
		logger('Bot disconnected from chat');
		process.exit(0);
	});

	const userFollowSubscription = await listener.subscribeToChannelFollowEvents(broadcasterId, async e => {
		username = e.userName.toLowerCase();
		logger(`${username} has followed.`);
		chatClient.followers.push(username);
		// Log name to permanent follow log - users should only get points for following ONCE.
		// Check if follower has followed before (name exists in followers.log)
		// if not, append name to followers.log
		// if they have, append their name to chatClient.followers
		// At only 2 kb, using synchronous version instead of async/stream is negligble. cope
		const followers_log = fs.readFileSync('./followers.log', 'utf8').split('\n');
		if (!followers_log.includes(username)) {
			// User's first time following - write their name to the log
			const writeStream = fs.createWriteStream('./followers.log', { flags: 'a' });
			writeStream.write('\n'+username);
			writeStream.end();
			
			//Update google sheets
			if (!pointsData.has(username)) pointsDataRange = pointsDataRange.slice(0, -1) + String(pointsData.size+2)
			pointsData = await updatePointsData(username, sheet, pointsData, pointsDataRange, chatClient.pointsRewards.follow);
			chatClient.say(e.broadcasterName, `!points ${username} can now start earning channel points. +500 for follow.`);
			logger(`Gave ${username} ${chatClient.pointsRewards.follow} points for following!`);
		} else {
			// User has already followed before!
			logger(`${username} has already followed before. No points awarded.`);
		}
	})

	const userFollowSubscription2 = await listener.subscribeToChannelFollowEvents(broadcasterId, async (e) => {
		username = e.userName.toLowerCase();
		logger(`${username} has followed.`);
		// On follow, create a user document in the DB with config.followPoints points.
		mongo.createUser(username);
	})

	process.on('SIGINT', () => {
		chatClient.quit();
		listener.unlisten();
		logger('Ctrl-C detected');
		process.exit(0);
	});

}
// main();