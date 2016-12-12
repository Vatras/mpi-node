var portfinder = require('portfinder');
var Q = require('q');

var stdio = require('stdio');
var ops = stdio.getopt({
    'numOfProcesses': {key: 'n',args: 1, mandatory: true,description: 'Another description'}
});
portfinder.basePort=12110;
console.log("ops[numOfProcesses]"+ops[numOfProcesses]);

portfinder.getPort(function (err, port) {
console.log(port);
});
