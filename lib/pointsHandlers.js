const logger = require("./logger");

async function getPointsData(sheet) {
	// To access directly with [0][0], must wrap await in parens
	const data_range = (await sheet.get('pointsData', 'ROWS'))[0][0]; 
	const data = await sheet.get(data_range, 'ROWS');
	return [convertSheetDataToMap(data), data_range];
}

async function updatePointsData(user, sheet, pointsData, pointsDataRange, amount) {
	let currentUserPoints;
	if (pointsData.get(user) === undefined) currentUserPoints = 0;
	else currentUserPoints = pointsData.get(user);

	pointsData.set(user, Number(currentUserPoints) + amount);
	logger(`${user}: ${pointsData.get(user) - amount} --> ${pointsData.get(user)}`);
	sheet.save(pointsDataRange, [...pointsData.entries()], 'ROWS');
	return pointsData;
}

function convertSheetDataToMap(sheetData) {
	// sheetData is a 2D array
	return new Map(sheetData.map( ([user, data]) => [user, data] ))
}

module.exports = {
	getPointsData,
	updatePointsData,
	convertSheetDataToMap
}