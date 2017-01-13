var portfinder = require('portfinder');
var Q = require('q');
var fs = require('fs');
var child_process = require('child_process');
var stdio = require('stdio');
var net = require('net');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var JsonSocket = require('json-socket')
var ops = stdio.getopt({
    'numOfProcesses': {key: 'n',args: 1, description: 'Another description'},
    'tid': {key: 't',args: 1,description: 'Id of process'},
    'initiatorPort': {key: 'a',args: 1,description: 'Id of process'}
});
portfinder.basePort=12110;
var tid = parseInt(ops['tid']);
var numOfProcesses = ops['numOfProcesses'];
var portsMap = [];
var myPort;
var socketMap=[];
var initiatorServer;
function connect(host,port){
    var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
    socket.connect(port, host);
    return socket;
}

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


function createProcesses(){
    for(var i = 1; i<numOfProcesses; i++) {
        var debug='';
        if(debugTid === i){
            debug='--debug '
        }
        console.log(portsMap);
        var workerProcess = child_process.exec('node '+debug+'app.js'+'>tid_'+i+' -t '+i+' -a '+myPort,function(){

        });
        console.log(i);
    }
}

function init(cb){
    setInterval(function(){},1000000);

    if(numOfProcesses){
        getPorts(numOfProcesses).then(function(data){
            console.log("portsArray= "+data);
            portsMap=data;
            myPort=data[0];
            createServer().then(createProcesses());
        });
    }
    else{
        console.log("child process. Tid="+tid);
        var initiatorPort = ops['initiatorPort'];
        console.log("initiatorPort: "+initiatorPort);
        createSocketConnectionWithInitiator(initiatorPort,cb);
    }
}


function createSocketConnectionWithInitiator(initiatorPort,cb){
    var deferred = Q.defer();
    initiatorServer = connect('localhost',initiatorPort);
    function createSocketConnection(){
        var numberOfConnections=1;
        socketMap = portsMap.map(function(port,index){
            if(index==0){
                return initiatorServer;
            }
            var tempSocket = connect('localhost',port);
            tempSocket.on('connect', function() {
                numberOfConnections++;
                if(numberOfConnections==numOfProcesses){
                  deferred.resolve();
                }
            return tempSocket;
            });
        })
        return deferred.promise;
    }
    initiatorServer.on('connect', function() { //Don't send until we're connected
        //socket.sendMessage({a: 5, b: 7});
        initiatorServer.on('message', function(message) {
            if(message.type === 'portsMap'){
            portsMap = message.array;
            console.log('Client received'+portsMap);
            myPort = portsMap[tid];
            createServerForClients()
                .then(createSocketConnection)
                .then(cb);
            }
        });
    });

}

function createServer(){
    var deferred = Q.defer();
    var server = net.createServer();
    server.listen({port: myPort},function(){
        deferred.resolve();
    });

    var creationsNumber=1;
    server.on('connection', function(socket) { //This is a standard net.Socket
        console.log("connection from client");
        socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket

        socket.sendMessage({type: 'portsMap',array: portsMap})

        socket.on('message', function(message,a,b) {
            if(message.type === 'serverCreated'){
                socketMap.push({tid:message.tid, socket: socket})
                creationsNumber++;
                if(creationsNumber == numOfProcesses){
                    socketMap=socketMap.sort(function(a,b){
                        return a.tid-b.tid
                    })
                    socketMap=socketMap.map(function(a,b){
                        return a.socket;
                    })
                    broadcast({type:'allServersCreated'});
                }
            }
            console.log("server received: "+JSON.stringify(message));
        });
    });
    return deferred.promise;
}
function broadcast(message){
    socketMap.forEach(function(socket){
        socket.sendMessage(message);
    })
}
function createServerForClients(){
    var deferred = Q.defer();
    var server = net.createServer();
    server.listen({port: myPort},function(){
        initiatorServer.sendMessage({tid: tid,type: 'serverCreated'})
        var startFunction = function(message){
            if(message.type==='allServersCreated'){
                console.log('received allServersCreated')
                //initiatorServer.removeListener(startFunction);
                deferred.resolve();
            }
        }
        initiatorServer.on('message',startFunction)
    });
    server.on('connection', function(socket) { //This is a standard net.Socket
        socket = new JsonSocket(socket);
        socket.on('message', function(message) {
            console.log("client received: "+message);
        });

    })
    return deferred.promise;
}

module.exports = {
    init: init,
    tid : tid,
    numOfProcesses : numOfProcesses,
    portsMap : portsMap,
    myPort : myPort,
    socketMap : socketMap,
    eventEmitter : eventEmitter
}
var debugTid=0;
if(numOfProcesses){
    init(function(){
    console.log("zainicjowano!")
})
}else{
    setTimeout(init,7000);
}