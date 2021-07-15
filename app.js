const { ApiClient } = require('twitch');
const { twitchClientCredentialsAuthProvider } = require('./lib/twitchAuth.js');
const { EventSubListener } = require('twitch-eventsub');
const { NgrokAdapter } = require('twitch-eventsub-ngrok');
const config = require('./config.js');
const logger = require('./lib/logger.js');
const mongo = require('./mongo/Mongo.js');
const initChat = require('./lib/Chat.js');
require('dotenv').config();
//in google-sheets-simple, go to /lib/Sheet.js --> ctrl+f 'keyFile' in function 'initialize', make sure path matches /security/sheets_cred.json
//remember to set the name of the namedRange to 'sheetData' in the google sheet!
//Remember to:
	// Make the .env file (use the right one)
	// Send over /security folder
	// Set named range in google sheet to 'sheetData'
	// Change google-sheets-simple/lib/Sheet.js initialize() to use keyFile
	// set environment variables to match 9hournap channel, not grganttank
	// Look through config.js to make sure everything is OK.
async function main() {
	logger('Starting bot.');
	// Connect to DB
	await mongo.connect();
	await mongo.updateFollowingStatus();

	// Set up event listener
	logger(`Setting up listener.`)
	const twitchApiClient = new ApiClient({ authProvider: twitchClientCredentialsAuthProvider() });
	const listener = new EventSubListener(twitchApiClient, new NgrokAdapter(), process.env.TWITCH_EVENTSUB_LISTENER_SECRET);
	await listener.listen();
	// Ensures that we don't hit the subscription cap
	await twitchApiClient.helix.eventSub.deleteAllSubscriptions();

	const userFollowSubscription = await listener.subscribeToChannelFollowEvents(config.broadcaster.id, async e => {
		username = e.userName.toLowerCase();
		logger(`${username} has followed.`);
		const user = await mongo.getUser(username);
		if (!user) {
			// User's first time following - write their name to the log
		  await mongo.createUser(username, true);
			// Update google sheets!
			await mongo.updateUserPoints(username, config.pointRewards.follow);
			chat.say(e.broadcasterName, `${username} can now start earning channel points. +${config.pointRewards.follow} for follow. (!points for more info)`);
			logger(`Gave ${username} ${config.pointRewards.follow} points for following!`);
		} else {
			await mongo.updateUserFollowingStatus(username, true);
			logger(`${username} has already followed before. No points awarded.`);
		}
	})
	
	logger(`Listener setup complete.`);

	// Set up chat
	logger(`Beginning chat setup.`);
	const chat = await initChat();
	logger(`Chat setup complete.`);
	logger(`Bot is fully initialized.`);

	process.on('SIGINT', () => {
		chat.quit();
		listener.unlisten();
		mongo.disconnect();
		logger('Ctrl-C detected');
		process.exit(0);
	});

}
main();