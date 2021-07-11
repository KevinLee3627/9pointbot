const { broadcaster } = require('../config');
const logger = require('../lib/logger');
const mongo = require('../mongo/Mongo');

// Thank you StackOverflow
function isNumeric(str) {
  if (typeof str != 'string') return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}
module.exports = {
	name: 'set',
	async execute(chatClient, args, msgSender) {
		const whitelist = [broadcaster.name];
		if (!whitelist.includes(msgSender)) return chatClient.say(broadcaster.name, `${msgSender}, you are not allowed to use this command.`);
		if (args.length == 2) {
			const [username, points] = args;
			const user = await mongo.getUser(username);
			if (!user) return chatClient.say(broadcaster.name, `User does not exist`)
			if (!isNumeric(points)) return chatClient.say(broadcaster.name, `Second argument should be a number.`);
			await mongo.updateUserPoints(username, points);
			chatClient.say(broadcaster.name, `${username} now has ${points} points.`);
		} else {
			chatClient.say(broadcaster.name, `Incorrect number of arguments. Needed: 2 | Input: ${args.length}`);
		}
	}
}