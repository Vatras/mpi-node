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
    'processToCreate': {key: 'n',args: 1, description: 'Number of processes given to initiator to create (including itself)'},
    'numOfProcesses': {key: 'p',args: 1, description: 'Number of processes to differ initiator from child processes'},
    'tid': {key: 't',args: 1,description: 'Id of process'},
    'initiatorPort': {key: 'a',args: 1,description: 'Id of process'}
});
var fs = require('fs');
portfinder.basePort=12110;
var numOfProcesses = ops['processToCreate'] ? parseInt(ops['processToCreate']) : parseInt(ops['numOfProcesses']);
var isInitiator = ops['processToCreate'] ? true : false;
var tid = isInitiator ? 0 : parseInt(ops['tid']);
var portsMap = [];
var myPort;
var socketMap=[];
var initiatorServer;
var server;
var debugTid;
function writePortsToFile(ports){
    fs.writeFile("public/ports.json", JSON.stringify(ports), function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("The file was saved!");
    }); 
    
}
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
        child_process.exec('node '+debug+'app.js'+'>tid_'+i+' -t '+i+' -a '+myPort+' -p '+numOfProcesses);
        console.log(i);
    }

}
function init(cb,tidToDebug){
    setInterval(function(){},1000000);
    debugTid = tidToDebug;
    if(isInitiator){
        getPorts(numOfProcesses).then(function(data){
            console.log("portsArray= "+data);
            portsMap=data;
            console.log("writing",portsMap)
            writePortsToFile(portsMap)
            myPort=data[0];
            createServer(cb).then(createProcesses());
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
        socketMap =  new Array(numOfProcesses);
         portsMap.forEach(function(port,index){
            if(index==0){
                socketMap[index] = initiatorServer;
                return;
            }
            var tempSocket = connect('localhost',port);
            tempSocket.on('connect', function() {
                socketMap[index] = tempSocket;
                tempSocket.sendMessage({type: 'initial', content:tid})
                numberOfConnections++;
                if(numberOfConnections==numOfProcesses){
                  deferred.resolve();
                }
            });
        })
        return deferred.promise;
    }
    initiatorServer.on('connect', function() { //Don't send until we're connected
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

function createServer(cb){
    socketMap = new Array(1)
    socketMap[0] = {tid:0}
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
                console.log("server received: "+JSON.stringify(message));
                socket.processTid = message.tid
                socketMap.push({tid:message.tid, socket: socket})
                creationsNumber++;
                if(creationsNumber === numOfProcesses){
                    socketMap=socketMap.sort(function(a,b){
                        return a.tid-b.tid
                    })
                    socketMap=socketMap.map(function(item,index){
                        return item.socket;
                    })
                    broadcast({type:'allServersCreated'});
                    cb();
                }
            }
            else{
                message.processTid = socket.processTid;
                eventEmitter.emit(message.type,message);
            }
        });
    });
    return deferred.promise;
}
function broadcast(message){
    console.log("broadcasting",JSON.stringify(message));
    socketMap.forEach(function(socket,index){
        if(index!=tid){
            socket.sendMessage(message);
        }
    })
}
function send(receiver,message){
    console.log("sending to",receiver,JSON.stringify(message));
    socketMap[receiver].sendMessage(message);
}

function createServerForClients(){
    var deferred = Q.defer();
    server = net.createServer();
    server.listen({port: myPort},function(){
        initiatorServer.sendMessage({tid: tid,type: 'serverCreated'})
        initiatorServer.on('message',function(message){
            console.log('initiator sent:',JSON.stringify(message));
            message.processTid=0;
            eventEmitter.emit(message.type,message);
            if(message.type==='allServersCreated'){
                console.log('received allServersCreated')
                //initiatorServer.removeListener(startFunction);
                deferred.resolve();
            }
        })

        server.on('connection', function(socket) { //This is a standard net.Socket
            console.log('connection from other client')
            socket = new JsonSocket(socket);
            socket.on('message', function(message) {
                if(message.type === 'initial'){
                    socket.processTid = message.content
                }
                console.log("client received on his socket: ",JSON.stringify(message));
                message.processTid = socket.processTid;
                eventEmitter.emit(message.type,message);
            });
        })
    });
    return deferred.promise;
}

function eventEmitterOn(event,cb){
    if(typeof event === 'string')
    {
        eventEmitter.on(event,cb)
    }else{
        eventEmitter.on(event.type,function(message){
            if(message.processTid === event.from){
                cb(message)
            }
        })
    }
}
function getPort(){
    return myPort
}
module.exports = {
    init: init,
    broadcast:broadcast,
    send : send,
    recv : eventEmitterOn,
    rank : tid,
    myPort : getPort,
    size : numOfProcesses
}
