var portfinder = require('portfinder');
portfinder.basePort=12110;
var Q = require('q');
var fs = require('fs');
var child_process = require('child_process');
var stdio = require('stdio');
var net = require('net');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var CodeDistribution = require('./lib/codeDistribution')
var JsonSocket = require('json-socket')
var ops = stdio.getopt({
    'processToCreate': {key: 'n',args: 1, description: 'Number of processes given to initiator to create (including itself)'},
    'port': {key: 'r',args: 1, description: 'Port to use'},
    'numOfProcesses': {key: 'p',args: 1, description: 'Number of processes to differ initiator from child processes'},
    'tid': {key: 't',args: 1,description: 'Id of process'},
    'initiatorPort': {key: 'a',args: 1,description: 'Id of process'},
    'initiatorHostname': {key: 'h',args: 1,description: 'Hostname of initiator'}
});
var ip = require("ip");
var fs = require('fs');
var numOfProcesses = ops['processToCreate'] ? parseInt(ops['processToCreate']) : parseInt(ops['numOfProcesses']);
var isInitiator = ops['processToCreate'] ? true : false;
var tid = isInitiator ? 0 : parseInt(ops['tid']);
var portsMap = [];
var myPort;
var socketMap=[];
var initiatorServer;
var server;
var debugTid;
function connect(host,port){
    var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
    socket.connect(port, host);
    return socket;
}

function getPorts(processesNumber){
    var deferred = Q.defer();
    portfinder.getPorts(parseInt(numOfProcesses),{},function (err, portsArray) {
        if(portsArray.length==processesNumber){
            deferred.resolve(portsArray);
        }
    });
    return deferred.promise;
}


var myIp = ip.address();
function createProcesses(processesToCreate){
    for(var i = 1; i<processesToCreate; i++) {
        var debug='';
        if(debugTid === i){
            debug='--debug '
        }
        console.log(portsMap);
        child_process.exec('node '+debug+'app.js'+'>tid_'+i
            +' -t '+i+
            ' -a '+myPort+
            ' -h '+myIp+
            ' -p '+processesToCreate+
            ' -r '+portsMap[i]+
            ' 2>err_tid'+i);
        console.log(i);
    }

}
var initiatorPort;
var globalTid;
var initiatorHostname;
var hostsList;
function init(cb,tidToDebug){
    setInterval(function(){},1000000);
    debugTid = tidToDebug;
    if(isInitiator){
        getPorts(numOfProcesses).then(function(data){
            console.log(ip.address());
            console.log("portsArray= "+data);
            portsMap=data;
            console.log("writing",portsMap)
            myPort=data[0];
            hostsList = CodeDistribution.distributeCodeToHosts(myPort,ip.address(),numOfProcesses);
            var local=hostsList.hosts.find(function(host){
                return host.hostname=='localhost'
            })
            var localProcesses = local ? local.processes : 0;
            createServer(cb).then(createProcesses(localProcesses));
        });
    }
    else{
        myPort=ops['port'];
        console.log("child process. Tid="+tid);
        initiatorPort = ops['initiatorPort'];
        initiatorHostname = ops['initiatorHostname'];
        console.log("initiatorPort: "+initiatorPort);
        console.log("initiatorHost: "+initiatorHostname);
        createSocketConnectionWithInitiator(cb);
    }
}


function createSocketConnectionWithInitiator(cb){
    var deferred = Q.defer();
    initiatorServer = connect(initiatorHostname,initiatorPort);
    function createSocketConnection(){
        var numberOfConnections=1;
        numOfProcesses=portsMap.length;
        socketMap =  new Array(numOfProcesses);
         portsMap.forEach(function(hostData,index){
             var port = hostData.port;
             var hostname = hostData.host;
            if(index==0){
                socketMap[index] = initiatorServer;
                return;
            }
            var tempSocket = connect(hostname,port);
            tempSocket.on('connect', function() {
                console.log('connected', numberOfConnections, numOfProcesses)
                socketMap[index] = tempSocket;
                tempSocket.sendMessage({type: 'initial', content:globalTid})
                numberOfConnections++;
                if(numberOfConnections==numOfProcesses){
                    console.log('resolve');
                    deferred.resolve();
                }
            });
        })
        return deferred.promise;
    }
    initiatorServer.on('connect', function() { //Don't send until we're connected
        // initiatorServer.emit('myPort',{myPort:myPort})
        initiatorServer.sendMessage({
            type: 'myPort',
            port:myPort,
            host: myIp
        })
        createServerForClients()
            .then(createSocketConnection)
            .then(cb);
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
    var connectionCount=1;
    globalTid=0;
    var portsMap=[{tid:0,port:myPort,host:myIp}];
    server.on('connection', function(socket) { //This is a standard net.Socket
        console.log("connection from client");
        socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket

        socket.on('message', function(message,a,b) {
            if(message.type === 'serverCreated'){
                creationsNumber++;
                if(creationsNumber === numOfProcesses){
                    socketMap=socketMap.sort(function(a,b){
                        return a.tid-b.tid
                    })
                    socketMap=socketMap.map(function(item,index){
                        return item.socket;
                    })
                    broadcast({type:'allServersCreated',portsMap:portsMap});
                    cb();
                }
            }
            else if(message.type === 'myPort'){
                var nodeGlobalTid = connectionCount;
                portsMap.push({tid: nodeGlobalTid,port:message.port,host:message.host});
                socketMap.push({tid:nodeGlobalTid, socket: socket})
                socket.processTid = nodeGlobalTid
                socket.sendMessage({type: 'globalTid',globalTid: nodeGlobalTid})
                connectionCount++;
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
  console.log("broadcasting", JSON.stringify(message));
  socketMap.forEach(function (socket, index) {
    if (index != globalTid) {
      socket.sendMessage(message);
    } else {
      eventEmitter.emit(message.type, message);
    }
  });
}
function send(receiver,message){
  console.log("sending to", receiver, JSON.stringify(message));
  if (receiver != globalTid) {
    socketMap[receiver].sendMessage(message);
  } else {
    eventEmitter.emit(message.type, message);
  }
}

function createServerForClients(){
    var deferred = Q.defer();
    server = net.createServer();
    server.listen({port: myPort},function(){
        initiatorServer.sendMessage({type: 'serverCreated'})
        initiatorServer.on('message',function(message){
            if(message.type=='globalTid'){
                globalTid=message.globalTid
                console.log('assigned global tid:',globalTid)
            }
            console.log('initiator sent:',JSON.stringify(message));
            message.processTid=0;
            eventEmitter.emit(message.type,message);
            if(message.type==='allServersCreated'){
                portsMap=message.portsMap
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
function getGlobalTid(){
    return globalTid
}
function getSize(){
    return numOfProcesses;
}
module.exports = {
    init: init,
    broadcast:broadcast,
    send : send,
    recv : eventEmitterOn,
    rank : getGlobalTid,
    myPort : getPort,
    size : getSize
}
