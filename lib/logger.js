module.exports = logger = msg => {
	const date = new Date();
	if (typeof msg === 'object' && msg != null) console.log(msg);
	console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}] ${msg}`);
}