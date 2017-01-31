/**
 * Created by Pjesek on 13.01.2017.
 */
var MPI = require('./mpi_module/mpi.js');

MPI.init(main)

function main(){
    var state='Begin'
    var tid = MPI.tid
    var timeoutTime=5000;
    var timeout;
    var numOfAnswers=0;
    if(tid == 0){
        sendCommitRequest();
        setInterval(sendCommitRequest,10000);
        function sendCommitRequest(){
            MPI.broadcast({type: 'CanCommit', content: 'transaction'})
            state = 'Waiting'
            timeout = setTimeout(function(){
                console.log('Abort timeout invoked')
                MPI.broadcast({type: 'Abort', content: 'transaction'})
                state = 'Aborted'
                console.log('State:',state)
            },timeoutTime)
        }

        MPI.eventEmitter.on('Yes',function(message){
            numOfAnswers++;
            if(numOfAnswers==MPI.numOfProcesses()-1){
                numOfAnswers=0;
                clearTimeout(timeout);
                MPI.broadcast({type: 'preCommit', content: 'transaction'})
                state = 'Prepared'
                timeout = setTimeout(function(){
                    MPI.broadcast({type: 'Abort', content: 'transaction'})
                    state = 'Aborted'
                    console.log('State:',state)
                },timeoutTime)
            }
        })
        MPI.eventEmitter.on('No',function(message){
            console.log('Received NO from one of the nodes')
            MPI.broadcast({type: 'Abort', content: 'transaction'})
            state = 'Aborted'
            console.log('State:',state)
        })
        MPI.eventEmitter.on('ACK',function(message){
            numOfAnswers++;
            if(numOfAnswers==MPI.numOfProcesses()-1){
                numOfAnswers=0;
                clearTimeout(timeout);
                MPI.broadcast({type: 'doCommit', content: 'transaction'})
                state = 'Commited'
                console.log('State:',state)
            }
        });
    }
    else{
        MPI.eventEmitter.on('CanCommit',function(message){
            timeout = setTimeout(abortHandler,timeoutTime);
            MPI.send(0,{type: 'Yes', content: 'transaction'})
            state = 'Waiting'
            console.log('State:',state)
        })
        MPI.eventEmitter.on('abort',abortHandler);

        MPI.eventEmitter.on('preCommit',function(message){
            clearTimeout(timeout);
            timeout = setTimeout(commitHandler,timeoutTime);
            MPI.send(0,{type: 'ACK', content: 'transaction'})
            state = 'Prepared'
            console.log('State:',state)
        })
        MPI.eventEmitter.on('doCommit',commitHandler)
    }
    function commitHandler(){
        if(timeout){
            clearTimeout(timeout);
        }
        console.log('transaction commited')
        state='Commited';
        console.log('State:',state)
    }
    function abortHandler(message){
        if(message){
            console.log('trasaction aborted due to message from coordinator')
        }else{
            console.log('trasaction aborted due to timeout')
        }
        if(timeout){
            clearTimeout(timeout);
            timeout=null;
        }
        state='aborted';
    }
}



// var debugTid = -1;
// setTimeout(function(){
//     MPI.init(main,debugTid)
// } ,debugTid > 0 ? 4000: 0);
