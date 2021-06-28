const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { promises: fs } = require('fs');

async function twitchAuthProvider() {
	const tokenData = JSON.parse(await fs.readFile(__dirname + '/../tokens.json'));
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
module.exports = twitchAuthProvider;