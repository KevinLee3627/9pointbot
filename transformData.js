const mongoose = require('mongoose');
const { User } = require('./mongo/schemas.js');
const logger = require('./lib/logger');
const { promises: fs } = require('fs');
const { getAllFollowers } = require('./lib/getFollowers.js');
require('dotenv').config();

const output = [];

async function main() {
	let currentFollowers = null;
	try {
		currentFollowers = (await getAllFollowers(process.env.BROADCASTER_ID_9HOURNAP)).map(follower => follower.user.name);
	} catch (err) {
		console.log(err);
	}
	console.log(currentFollowers);
	const followersLog = (await fs.readFile(__dirname + '/followers_master.log', 'utf-8')).split('\n');
	// console.log(followersLog);
	const userData = (await fs.readFile(__dirname + '/streampointsdump.csv', 'utf-8')).split('\r\n');
	// console.log(userData);
	const newUserData = userData.map(rowStr => {
		let [username, points] = rowStr.split(',');
		rowStr += ',0'; //lastMessageTimestamp
		
		// Set if currently following
		if (currentFollowers.includes(username)) rowStr += ',true'
		else { rowStr += ',false'; }

		// Set if has followed
		if (followersLog.includes(username)) {
			rowStr += ',true';
		} else { rowStr += ',false'}

		return rowStr
	}).join('\n');
	await fs.writeFile(__dirname + '/streampointsdump.csv', newUserData, 'utf-8');

}
main()