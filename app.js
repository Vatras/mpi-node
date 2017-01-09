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
var tid = ops['tid'];
var numOfProcesses = ops['numOfProcesses'];
var portsMap = {};
var myPort;
var socketMap=[];
function connect(host,port){
    JsonSocket = require('json-socket');
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
        var array = JSON.stringify(portsMap);
        console.log(array);
        var workerProcess = child_process.exec('node app.js'+'>tid_'+i+' -t '+i+' -a '+myPort,function(){

        });
        console.log(i);
    }
}

function init(cb){
    setInterval(function(){},1000000);

    if(numOfProcesses){
        getPorts(numOfProcesses).then(function(data){
            console.log("portsArray= "+data);
            portsMap.array=data;
            myPort=data[0];
            createServer();
            createProcesses();
        });
    }
    else{
        console.log("child process. Tid="+tid);
        var initiatorPort = ops['initiatorPort'];
        console.log("initiatorPort: "+initiatorPort);
        createSocketConnectionWithInitiator(initiatorPort,cb);
    }
}
function createSocketConnection(ports,serverSocket,cb){
    var numberOfConnections=1;
    socketMap = ports.map(function(port,index){
        if(index==0){
            return serverSocket;
        }
        var socket = connect('localhost',port);
        socket.on('connect', function() { //Don't send until we're connected
            numberOfConnections++;
            if(numberOfConnections==numOfProcesses){
                if(cb){
                    cb();
                }
            }
        });
    })


}

function createSocketConnectionWithInitiator(initiatorPort,cb){
    var socket = connect('localhost',initiatorPort);
    socket.on('connect', function() { //Don't send until we're connected
        //socket.sendMessage({a: 5, b: 7});
        socket.on('message', function(message) {
            var array = JSON.stringify(message);
            console.log('Client received'+array);

            myPort = array[tid];
            createServerForClients();
            createSocketConnection(message.array,socket,cb);
        });
    });
}

function createServer(){
    var server = net.createServer();
    server.listen(myPort);
    server.on('connection', function(socket) { //This is a standard net.Socket
        console.log("connection from client");
        socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
        socket.sendMessage(portsMap)
        socket.on('message', function(message) {
            console.log("server received: "+message);
        });
    });
}
function createServerForClients(){
    var server = net.createServer();
    server.listen(myPort);
    server.on('connection', function(socket) { //This is a standard net.Socket
        socket = new JsonSocket(socket);
        console.log("connection from other clients");
        socket.on('message', function(message) {
            console.log("client received: "+message);
        });
    });
}

module.exports = {
    init: init,
    tid : tid,
    numOfProcesses : numOfProcesses,
    portsMap : portsMap,
    myPort : myPort,
    socketMap : socketMap
}

init(function(){
    console.log("zainicjowano!")
})