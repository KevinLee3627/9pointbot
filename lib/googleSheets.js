const { Sheet } = require('google-sheets-simple');
const logger = require("./logger");

class GoogleSheet {
	constructor() {
		this.sheet = new Sheet(process.env.GOOGLE_SHEET_ID);
		this.sheet.initialise();
		logger(`Sheet initialized.`);
	}

	convertSheetDataToMap(sheetData) {
		// sheetData is a 2D array
		return new Map(sheetData.map( ([user, data]) => [user, data] ))
	}

	async getSheetData() {
		// To access directly with [0][0], must wrap await in parens
		const data_range = (await this.sheet.get('sheetData', 'ROWS'))[0][0]; 
		const data = await this.sheet.get(data_range, 'ROWS');
		return [this.convertSheetDataToMap(data), data_range];
	}

	async updatePointsData(user, sheetData, sheetDataRange, amount) {
		sheetData.set(user, amount);
		this.sheet.save(sheetDataRange, [...sheetData.entries()], 'ROWS');
	}

	async updateSheet(username, points) {
		let [sheetData, sheetDataRange] = await this.getSheetData(this.sheet);
		// Adds new users to data object if they have never gotten points before
		if (!sheetData.has(username)) {
			//+1 for header, +1 for extending another row
			sheetDataRange = sheetDataRange.slice(0, -1) + String(sheetData.size+2); 
		}
		await this.updatePointsData(username, sheetData, sheetDataRange, points);
	}
}



module.exports = new GoogleSheet();