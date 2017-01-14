/**
 * Created by Pjesek on 13.01.2017.
 */
var MPI = require('./mpi_module/mpi.js');

MPI.init(main)

function main(){
    var tid = MPI.tid
    if(tid == 1){
        MPI.broadcast({type: 'hello', content: 'world'})
    }
    else{
        MPI.eventEmitter.on('hello',function(message){
            console.log("received message:" +message.content)
        })
    }
}



// var debugTid = -1;
// setTimeout(function(){
//     MPI.init(main,debugTid)
// } ,debugTid > 0 ? 4000: 0);
