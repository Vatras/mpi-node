/**
 * Created by pjesek on 12.10.17.
 */
var fs = require('fs');
var exec = require('child_process').exec;
var net = require('net');
var Q = require('q');

function compressProject(){
    var fileName='tempTar'
    var deferred = Q.defer();

    exec('tar cvzf output'+fileName+'.tar *', function(output){
        console.log(fileName)
        deferred.resolve(fileName);
    });
    return deferred.promise;
}
function readFileAndSend(fileName,client){
    fs.createReadStream('output'+fileName+'.tar',
        {'flags': 'r',
            'encoding': 'binary', 'mode': 0777,
            'bufferSize': 64})
        .addListener('data', function(chunk){
            client.write(new Buffer(chunk,"binary"));
        })
        .addListener('close',function() {
            setTimeout(function(){
                client.write('$MPIEND$');
                exec('rm -f output'+fileName+'.tar', function(output){
                    console.log('deleted')
                });
            },1000)
        })
}
function sendProjectToHost(options){
    var client = new net.Socket();
    options.processes = options.toCreteCount-processesCreated > options.processes ? options.processes : options.toCreteCount-processesCreated;
        client.connect(options.port, options.host, function(err) {
            console.log(err)
            client.write(options.processes+';'+options.initiatorPort+';'+options.initiatorHost+';'+options.mainFile+';'+options.additionalOptions+';'+'$MPISTART$');
            setTimeout(function(){
                readFileAndSend(options.fileName,client)
            },1500)

        });

    client.on('close', function() {
        exec('rm -f output'+options.fileName+'.tar', function(){
        });
    });

    client.on('error', function(err) {
        throw new Error('Socket connection error');
    });
}

function readConfigFile(){
    try{
        var hostsList = fs.readFileSync(process.cwd()+'/hosts.json', 'utf8');
        hostsList = JSON.parse(hostsList);
        return hostsList
    }catch(e){
        console.log("Please provide a hosts file in the root directory where main app.js is",e)
    }
    return null;
}
var processesCreated=0;

function checkIfEnoughProcesses(toCreteCount,hosts){
    var processes = hosts.reduce(function(a,b){
        return a.processes + b.processes
    })
    console.log("processes",processes)
    if(processes<toCreteCount){
        console.log("MPI_ERROR: not enough processes in hosts file (sum of processes is less than provided in -n switch)")
        process.exit();
    }
}

function distributeCodeToHosts(initiatorPort,initiatorHost,toCreteCount){
    function sendProjectToHosts(fileName){
        checkIfEnoughProcesses(toCreteCount,hostsList.hosts);
        hostsList.hosts.forEach(function(val){
            if(val.hostname!='localhost'){
                if(processesCreated<toCreteCount){
                    sendProjectToHost({
                        fileName: fileName,
                        host: val.hostname,
                        port : 5666,
                        processes : val.processes,
                        initiatorPort : initiatorPort,
                        initiatorHost:initiatorHost,
                        toCreteCount:toCreteCount,
                        additionalOptions : hostsList.additionalOptions,
                        mainFile : hostsList.mainFile || 'app.js'
                    });
                }
            }else{
                processesCreated+=val.processes;
            }
        })
    }
    var hostsList = readConfigFile();
    if(hostsList){
        compressProject().then(sendProjectToHosts);
    }
    return hostsList;
}

module.exports = {
    distributeCodeToHosts : distributeCodeToHosts
}