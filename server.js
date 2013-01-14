var connect = require('connect');

var path = __dirname;
var port = 8888;

connect()
	.use(connect.logger('dev'))
	.use(connect.static(path))
	.listen(port);

console.log('Started server for: ' + path);
console.log('Listening on ' + port + '...');
console.log('Press Ctrl + C to stop.');
