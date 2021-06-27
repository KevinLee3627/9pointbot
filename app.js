const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { ChatClient } = require('twitch-chat-client');
const { promises: fs } = require('fs');

require('dotenv').config();


// Getting oauth token (client credentials)



async function main() {
	const tokenData = JSON.parse(await fs.readFile('./tokens.json'));
	const authProvider = new RefreshableAuthProvider(
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
				await fs.writeFile('./tokens.json', JSON.stringify(newTokenData, null, 4), 'UTF-8')				
			}
		}
	)
	const chatClient = new ChatClient(authProvider, { channels: ['Granttank'] });
	await chatClient.connect();
	chatClient.onMessage((channel, user, msg) => {
		console.log(msg);
		if (msg === '!points') {
			chatClient.say(channel, `go to https://www.google.com`)
		}
	})
}
main();

// {
// 	"access_token": "ck7dep8e7urmoqmzjqg89tykjc1kgy",
// 	"expires_in": 14207,
// 	"refresh_token": "nkg725hg8mk808id6wq335psy4wlx7ish97n4i7bmjymi6m8nr",
// 	"scope": [
// 			"chat:edit",
// 			"chat:read"
// 	],
// 	"token_type": "bearer"
// }