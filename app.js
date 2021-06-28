const { ApiClient } = require('twitch')
const twitchAuthProvider = require('./util/twitchAuth.js');
const { ChatClient } = require('twitch-chat-client');
const { Sheet, Range } = require('google-sheets-simple');
const { getPointsData, updatePointsData } = require('./util/points.js')

require('dotenv').config();

async function isStreamLive(apiClient, userName) {
	try {
		const streamData = await apiClient.helix.streams.getStreamByUserName(userName);
		console.log(`${userName}'s stream started at ${streamData.startDate}`)
		return streamData.startDate;
	} catch (err) {
		if (err instanceof TypeError) {
			console.log(`${userName}'s stream is not live!`)
			return false;
		}
	}
}

async function main() {
	// Initialize google sheets instance
	const sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
	const misc = await sheet.initialise();
	let [pointsData, pointsDataRange] = await getPointsData(sheet);
	console.log(pointsData);

	
	const twitchAuth = await twitchAuthProvider();
	// Initilize twitch API client
	const twitchApiClient = new ApiClient({ authProvider: twitchAuth });

	//TODO: how the hell do i only give points ONCE per stream?
		//just disconnect the chatClient once stream is over? maybe i need to set up the eventlistener anyways...
	// setInterval(() => {
	// 	// Twitch PubSub doesn't tell you if a streamer goes online, too lazy to set up event subscriptions
	// 	isStreamLive(twitchApiClient, '9hournap');
	// }, 10000)

	// Initialize twitch CHAT client
	const chatClient = new ChatClient(twitchAuth, { channels: ['Granttank', '9hournap'] });
	// Initialize commands
	chatClient.commands = {}
	

	await chatClient.connect();
	chatClient.onMessage(async (channel, user, msg) => {
		const date = new Date();
		console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]:[${channel}] ${user}: ${msg}`);
		
		if (!pointsData.has(user)) {
			pointsDataRange = pointsDataRange.slice(0,-1) + String(pointsData.size+2); //+1 for header, +1 for extending another row
		}
		pointsData = await updatePointsData(user, sheet, pointsData, pointsDataRange);

		//
	})
}
main();