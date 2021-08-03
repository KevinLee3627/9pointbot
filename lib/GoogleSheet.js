const { Sheet } = require('google-sheets-simple');
const mongo = require('../mongo/mongo');
const logger = require('./logger');
require('dotenv').config();

class GoogleSheet {
	constructor() {
		this.sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
		this.sheet.initialise();
		logger(`Sheet initialized.`);
	}

	/**
	 * Converts sheet data into a Map where entry has form (username --> points)
	 * @param {Array} sheetData 2D array of the google sheet
	 * @returns {Map}
	 */
	convertSheetDataToMap(sheetData) {
		// sheetData is a 2D array
		return new Map(sheetData.map( ([username, ...data]) => {
			let [ points, poolTopic ] = data;
			return [ username, { points, poolTopic } ]
		}))
	}

	convertMapDataToSheet(mapData) {
		let rows = [];
		for (let entry of mapData) {
			const username = entry[0];
			rows.push([username, entry[1].points, entry[1].poolTopic])
		}
		return rows;
	}

	/**
	 * Reads google sheet data and returns it as a Map along with the range of the data
	 * @returns {Object} containing the sheet data and relevant range
	 */
	async getSheetData() {
		// To access directly with [0][0], must wrap await in parens
		const data_range = (await this.sheet.get('sheetData', 'ROWS'))[0][0]; 
		const data = await this.sheet.get(data_range, 'ROWS');
		return {
			sheetData: this.convertSheetDataToMap(data), 
			sheetDataRange: data_range
		};
	}
	// TODO: Update docstrings for everything here
	/**
	 * Updates the google sheet with the new point value
	 * @param {String} username Username of user that should be updated
	 * @param {Map} sheetData Map of usernames to their points
	 * @param {String} sheetDataRange The range in the google sheet that should be updated
	 * @param {Number} amount New points value
	 */
	async updateUserData(username, sheetData, sheetDataRange, field, value) {
		try {
			// 
			const userData = await mongo.getUser(username);
			userData[field] = value;
			sheetData.set(username, userData);
			this.sheet.save(sheetDataRange, this.convertMapDataToSheet(sheetData), 'ROWS');
		} catch (err) {
			console.log(err);
		}
	}

	/**
	 * Retrieves sheet data, updates a user with a new points value, then writes it back
	 * @param {*} username Username of user that should be updated
	 * @param {*} points New points value for user
	 */
	async updateSheet(username, field, value) {
		let { sheetData, sheetDataRange } = await this.getSheetData(this.sheet);
		// Adds new users to data object if they have never gotten points before
		if (!sheetData.has(username)) {
			//+1 for header, +1 for extending another row
			// Maybe not??? wtf??? TODO: Take a look at this part again
			const offset = sheetDataRange.length - 'Sheet1!A1:C'.length;
			sheetDataRange = sheetDataRange.slice(0, -offset) + String(sheetData.size+1);
		}
		await this.updateUserData(username, sheetData, sheetDataRange, field, value);
	}
}

const sheet = new GoogleSheet();

module.exports = sheet;