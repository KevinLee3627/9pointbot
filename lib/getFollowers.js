// The twitch api package is not updated to use _cursor instead of offset in their query parameters,
// thus custom code was necessary.
const axios = require('axios');
const logger = require('./logger');

async function getAllFollowers(userId) {
	const url = `https://api.twitch.tv/kraken/channels/${userId}/follows`;
	const headers = {
		'Client-Id': process.env.CLIENT_ID,
		'Accept': 'application/vnd.twitchtv.v5+json'
	}

	const getFollowers = async function(cursor='') {
		let params = { limit: 100 };
		if (cursor.length !== 0) params.cursor = cursor;
		return await axios({ method: 'GET', url: url, headers: headers, params: params });	
	}

	let allFollowers = [];
	let res = await getFollowers();
	allFollowers = [...allFollowers, ...res.data.follows];
	while (res.data._cursor) {
		res = await getFollowers(res.data._cursor);
		allFollowers = [...allFollowers, ...res.data.follows];
	}

	logger(`Retrieved ${allFollowers.length} followers.`);
	return allFollowers;
}

module.exports = {
	getAllFollowers
}
	

