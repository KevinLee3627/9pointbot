const prompt = require('prompt-sync')({sigint: true});

const mongo = require('./mongo/Mongo');
const config = require('./config.js');


// await mongo.createUser(username, true);
// await mongo.updateUserPoints(username, config.pointRewards.follow);

async function main() {
	await mongo.connect();
	console.log('---------------------------------');
	console.log("Don't freak out if you make a typo... just CTRL+C and run the .bat file again, ");
	console.log("and if you end up entering wrong data into the db,");
	console.log("just keep a log of which entries are incorrect and let me know eventually.");
	console.log("It's not a big deal");
	console.log('---------------------------------');
	console.log('This script will create a NEW USER in the DB and also put their name in the spreadsheet with 500 points');
	console.log('If they also talk to earn points, just use !set to update their point values in the DB as well.');
	console.log("Don't update the sheet thinking that those changes will persist, anything not set in the database ");
	console.log("is not real.");
	console.log('---------------------------------');
	const username = prompt('Username: ');
	try {
		const user = await mongo.getUser(username);
		if (user != null) {
			console.log('User already exists in database: ');
			console.log(user);
			process.exit(0);
		} else {
			await mongo.createUser(username.toLowerCase(), true);
			await mongo.updateUserPoints(username.toLowerCase(), config.pointRewards.follow);
			console.log('User created');
			console.log('Pausing script execution for 3 seconds to make sure db is updated...');
			await new Promise(resolve => setTimeout(resolve, 3000));
			let userResult = await mongo.getUser(username.toLowerCase());
			console.log(userResult);
			process.exit(0);
		}
	} catch (err) {
		console.log(err);
	}
}

main();