var portfinder = require('portfinder');
var Q = require('q');

var stdio = require('stdio');
var ops = stdio.getopt({
    'numOfProcesses': {key: 'n',args: 1, mandatory: true,description: 'Another description'}
});

function getPorts(processesNumber){
    var deferred = Q.defer();
    var portsArray=[];
    for(var i=0;i<numOfProcesses;i++){
        portfinder.getPort(function (err, port) {
            portsArray.push(port);
            console.log(port);
            if(portsArray.length==processesNumber){
                deferred.resolve(portsArray);
            }
        });
    }
    return deferred.promise;
}

portfinder.basePort=12110;
var numOfProcesses = ops['numOfProcesses'];

getPorts(numOfProcesses).then(function(data){
    console.log("portsArray= "+data);
    var portsMap = {};
    var processMap = data.map(function(item,index){
        portsMap[index]=item;
    })
    console.log(portsMap);
});




