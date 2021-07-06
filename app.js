const fs = require('fs');
const { ApiClient } = require('twitch');
const { twitchRefreshableAuthProvider, twitchClientCredentialsAuthProvider } = require('./lib/twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const { EventSubListener, DirectConnectionAdapter } = require('twitch-eventsub');
const { NgrokAdapter } = require('twitch-eventsub-ngrok');
const { Sheet, Range } = require('google-sheets-simple');
const { getPointsData, updatePointsData } = require('./lib/pointsHandlers.js');
const { getAllFollowers } = require ('./lib/getFollowers.js');

require('dotenv').config();
//in google-sheets-simple, go to /lib/Sheet.js --> ctrl+f "keyFile", make sure path matches /security/sheets_cred.json

const shouldIgnore = (user) => ['9pointbot', 'nightbot', '9hournap'].includes(user);

async function main() {
	// Initialize google sheets instance
	const sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
	await sheet.initialise();
	let [pointsData, pointsDataRange] = await getPointsData(sheet);
	console.log(pointsData);

	//Set up twitch stuff (auth, api clients, eventsub listneer)
	const twitchOAuth = await twitchRefreshableAuthProvider();
	const twitchClientCredentialsAuth = await twitchClientCredentialsAuthProvider();
	const twitchApiClient = new ApiClient({ authProvider: twitchClientCredentialsAuth });
	// TODO: How to rewrite code so listener will be reassigned after 
	const listener = new EventSubListener(twitchApiClient, new NgrokAdapter(), process.env.TWITCH_EVENTSUB_LISTENER_SECRET);
	const userData = await twitchApiClient.helix.users.getUserByName('9hournap');
	const streamerId = userData.id;
	

	// Ensures that we don't hit the subscription cap
	await twitchApiClient.helix.eventSub.deleteAllSubscriptions();

	const chatClient = new ChatClient(twitchOAuth, { channels: ['9hournap', 'granttank'] });
	await chatClient.connect(); //REMOVE IN PRODUCTION
	chatClient.followers = (await getAllFollowers(streamerId)).map(follower => follower.user.name);
	// chatClient.followers.forEach(f => console.log(f))
	chatClient.commands = {}
	chatClient.streamPointsReceived = [];
	chatClient.usersThatGambled= [];
	chatClient.pointsRewards = {
		'firstMessage': 500,
		'follow': 500
	}
	chatClient.onMessage(async (channel, username, msg, fullMsg) => {
		username = fullMsg.userInfo.userName.toLowerCase(); //everything should be done in lowercase to be careful

		if (shouldIgnore(username)) return; //bot should ignore itself

		if (msg === '!bot') {
			chatClient.say(channel, '9pointbot automatically distributes points for talking (once per stream) and following (once per life). Made by Granttank, DM him or bug the streamer to bug me if there are any issues. Currently a work in progress!');
			return;
		}
		if (msg === '!granttank') {
			chatClient.say(channel, 'EZ the streamer won\'t take your money, but I will! venmo: kevinnivekkevin');
			return;
		}

		const date = new Date();
		const isFollowing = chatClient.followers.includes(username);
		const receivedPassivePoints = chatClient.streamPointsReceived.includes(username);
		console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]:[${channel}] [Following: ${isFollowing} | Received Points: ${receivedPassivePoints}] ${username}: ${msg}`);
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

	const onlineSubscription = await listener.subscribeToStreamOnlineEvents(streamerId, async e => {

		const date = new Date();
		console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}] ${e.broadcasterDisplayName} just went live!`);
		await listener.listen();
		await chatClient.connect();
		chatClient.say(e.broadcasterName, `9pointbot is up and ready for service!`)
		console.log('Bot connected to chat!');
	});
	
	const userFollowSubscription = await listener.subscribeToChannelFollowEvents(streamerId, async e => {
		username = e.userName.toLowerCase();
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
			console.log(`Gave ${username} ${chatClient.pointsRewards.follow} points for following!`);
		} else {
			// User has already followed before!
			console.log(`${username} has already followed before. No points awarded.`);
		}
		// How to track people who have followed?
	})

	const offlineSubscription = await listener.subscribeToStreamOfflineEvents(streamerId, async e => {
		console.log(`${e.broadcasterDisplayName} just went offline`);
		console.log(`Users who have received points for the day: ${chatClient.streamPointsReceived}`);
		await chatClient.quit();
		await listener.unlisten();
		console.log('Bot disconnected from chat');
	});

}
main();