const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { ChatClient } = require('twitch-chat-client');
const { promises: fs, readFileSync, readFile } = require('fs');
const { Sheet, Range } = require('google-sheets-simple');

require('dotenv').config();

async function twitchAuthProvider() {
	const tokenData = JSON.parse(await fs.readFile('./tokens.json'));
	return new RefreshableAuthProvider(
		new StaticAuthProvider(process.env.CLIENT_ID, tokenData.accessToken),
		{
			clientSecret: process.env.CLIENT_SECRET,
			refreshToken: tokenData.refreshToken,
			expiry: tokenData.expiryTimestamp === null ? null : new Date(tokenData.expiryTimestamp),
			onRefresh: async ({ accessToken, refreshToken, expiryDate}) => {
				const newTokenData = {
					accessToken,
					refreshToken,
					expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
				};
				await fs.writeFile('./tokens.json', JSON.stringify(newTokenData, null, 4), 'UTF-8');
				console.log('NEW TOKENS WRITTEN TO tokens.json');
			}
		}
	)
}

function convertSheetDataToObj(sheetData) {
	// sheetData is a 2D array
	return new Map(sheetData.map( ([user, data]) => [user, data] ))
}

async function getPointsData(sheet) {
	// To access directly with [0][0], must wrap await in parens
	const data_range = (await sheet.get('pointsData', 'ROWS'))[0][0]; 
	const data = await sheet.get(data_range, 'ROWS');
	return [convertSheetDataToObj(data), data_range];
}

async function updatePointsData(user, sheet, pointsData, pointsDataRange) {
	let currentUserPoints = pointsData.get(user);
	pointsData.set(user, Number(currentUserPoints) + 500);
	let updatedPointsData = [...pointsData.entries()]
	sheet.save(pointsDataRange, updatedPointsData, 'ROWS');
}

async function main() {
	// Initialize google sheets instance
	const sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
	const misc = await sheet.initialise();
	const [pointsData, pointsDataRange] = await getPointsData(sheet);
	console.log(pointsData);


	const chatClient = new ChatClient(await twitchAuthProvider(), { channels: ['Granttank'] });
	// Initialize commands
	chatClient.commands = {}
	
	await chatClient.connect();
	chatClient.onMessage((channel, user, msg) => {
		const date = new Date();
		console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}] ${user}: ${msg}`);


		updatePointsData(user, sheet, pointsData, pointsDataRange);
	})
}
main();