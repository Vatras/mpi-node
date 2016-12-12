var portfinder = require('portfinder');
var Q = require('q');
var fs = require('fs');
var child_process = require('child_process');
var stdio = require('stdio');
var ops = stdio.getopt({
    'numOfProcesses': {key: 'n',args: 1, description: 'Another description'},
    'tid': {key: 't',args: 1,description: 'Id of process'},
    'initiatorPort': {key: 'a',args: 1,description: 'Id of process'}
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
var tid = ops['tid'];
var numOfProcesses = ops['numOfProcesses'];
var portsMap = {};
var myPort;
if(numOfProcesses){
    getPorts(numOfProcesses).then(function(data){
        console.log("portsArray= "+data);
        portsMap.array=data;
        myPort=data[0];
        main();
    });
    function main(){
        for(var i = 1; i<numOfProcesses; i++) {
        var array = JSON.stringify(portsMap);
        console.log(array);
        var workerProcess = child_process.exec('node app.js'+'>tid_'+i+' -t '+i+' -a '+myPort,function(){
            
        });
        console.log(i);
        }
        setTimeout(function(){
        console.log("end");
            
        },10000);
    }
    
}
else{
    console.log("child process. Tid="+tid);
    var initiatorPort = ops['initiatorPort'];
    
    console.log(initiatorPort);
    
    setTimeout(function(){
        console.log("ends");
            
        },10000);
}




