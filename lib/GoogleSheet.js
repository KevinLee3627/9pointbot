const { Sheet } = require('google-sheets-simple');
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
		return new Map(sheetData.map( ([username, data]) => [username, data] ))
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
			data: this.convertSheetDataToMap(data), 
			range: data_range
		};
	}

	/**
	 * Updates the google sheet with the new point value
	 * @param {String} username Username of user that should be updated
	 * @param {Map} sheetData Map of usernames to their points
	 * @param {String} sheetDataRange The range in the google sheet that should be updated
	 * @param {Number} amount New points value
	 */
	async updatePointsData(username, sheetData, sheetDataRange, amount) {
		sheetData.set(username, amount);
		this.sheet.save(sheetDataRange, [...sheetData.entries()], 'ROWS');
	}

	/**
	 * Retrieves sheet data, updates a user with a new points value, then writes it back
	 * @param {*} username Username of user that should be updated
	 * @param {*} points New points value for user
	 */
	async updateSheet(username, points) {
		let { data: sheetData, range: sheetDataRange } = await this.getSheetData(this.sheet);
		// Adds new users to data object if they have never gotten points before
		if (!sheetData.has(username)) {
			//+1 for header, +1 for extending another row
			sheetDataRange = sheetDataRange.slice(0, -1) + String(sheetData.size+2); 
		}
		await this.updatePointsData(username, sheetData, sheetDataRange, points);
	}
}

const sheet = new GoogleSheet();

module.exports = sheet;