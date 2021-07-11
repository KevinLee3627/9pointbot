const { ApiClient } = require('twitch');
const { twitchRefreshableAuthProvider, twitchClientCredentialsAuthProvider } = require('./lib/twitchAuth.js');
const { EventSubListener } = require('twitch-eventsub');
const { NgrokAdapter } = require('twitch-eventsub-ngrok');
const { promises: fs } = require('fs');

const config = require('./config.js');
const logger = require('./lib/logger.js');
const mongo = require('./mongo/mongo.js');
const init_chat = require('./lib/chat.js');
const sheet = require('./lib/googleSheets.js');
require('dotenv').config();
//in google-sheets-simple, go to /lib/Sheet.js --> ctrl+f "keyFile" in function "initialize", make sure path matches /security/sheets_cred.json
//remember to set the name of the namedRange to 'sheetData' in the google sheet!
async function main() {
	logger('Starting bot.');

	// Set up event listener
	logger(`Setting up listener.`)
	const twitchApiClient = new ApiClient({ authProvider: twitchClientCredentialsAuthProvider() });
	const listener = new EventSubListener(twitchApiClient, new NgrokAdapter(), process.env.TWITCH_EVENTSUB_LISTENER_SECRET);
	await listener.listen();
	// Ensures that we don't hit the subscription cap
	await twitchApiClient.helix.eventSub.deleteAllSubscriptions();

	const onlineSubscription = await listener.subscribeToStreamOnlineEvents(config.broadcaster.id, async e => {

	})

	const offlineSubscription = await listener.subscribeToStreamOfflineEvents(config.broadcaster.id, async e => {
		
	})

	const userFollowSubscription = await listener.subscribeToChannelFollowEvents(config.broadcaster.id, async e => {
		username = e.userName.toLowerCase();
		logger(`${username} has followed.`);
		const user = await mongo.getUser(username);
		if (!user) {
			// User's first time following - write their name to the log
		  await mongo.createUser(username);
			// Update google sheets!
			await sheet.updateSheet(username, config.followPoints);

			chat.say(e.broadcasterName, `!points ${username} can now start earning channel points. +500 for follow.`);
			logger(`Gave ${username} ${chat.pointsRewards.follow} points for following!`);
		} else {
			logger(`${username} has already followed before. No points awarded.`);
		}
	})
	logger(`Listener setup complete.`)
	
	// Set up chat
	logger(`Beginning chat setup.`)
	const chat = await init_chat();
	logger(`Chat setup complete.`)

	process.on('SIGINT', () => {
		chat.quit();
		listener.unlisten();
		mongo.disconnect();
		logger('Ctrl-C detected');
		process.exit(0);
	});

}
main();