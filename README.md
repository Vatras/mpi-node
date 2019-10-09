MPI implementation in node.js.  
MPI is a message passing protocol implemented as a library in most of modern programming languages.  
MPI allows programmer to create a cluster of nodes - locally or distributed. Each node is assigned an individual tid - own id from 0 to n, where n is a size of the cluster. Every node executes the same code, but behaves differently depending on its id.
The API in this MPI implementation is basic and the methods that can be used are:
```js
MPI.init(callback);
//executes callback after the nodes connect with each other
```
```js
MPI.rank();
// returns an unique id of the node which executes the code
```
```js
MPI.size()
//returns the size of the cluster (the number of nodes)
```
```js
MPI.recv(msgType, callback)
function callback(data){
}
//starts to listen on all messages with msgType type and invokes callback on each message with the content as first parameter
```
```js
MPI.broadcast({type: msgType, content: data});
//sends the data object to all the nodes that are listeing to msgType event

```
```js
MPI.send(nodeId,{type: msgType, content: data});
//sends the data object only to a node with tid equal to nodeId. The type of this message is msgType.
```


You need a hosts.json file in a root directory (with at least the localhost entry - local machine must be named localhost,
not via IP address).
It has to be a valid JSON file - with the keys in " ".
```js
    "hosts" :
    [
        {
            "hostname": "localhost",
            "processes": 2
        },
        {
            "hostname": "192.168.1.10",
            "processes": 3
        }
    ],
    "mainFile" : "app.js"

```
Check a client for mpi-node  - [mpi-node-cli] - for using mpi-node as a cluster of distributed nodes.
To use remote machines in the cluster, the mpi-node-cli has to be run there.
npi-node-cli doesnt need to be run on localhost and in fact shouldn't), only on remote machines.
usage:
```sh
$ npm install -g mpi-node-cli
$ mpi-node-cli
```
Package requires port 5666 open.
It is only available on LINUX systems.

Available for node.js version 4.x or upper.

Basic example of 3 phase commit algorithm using mpi-node library:
```js
const MPI = require('mpi-node');
MPI.init(main);
function main () {
    const tid = MPI.rank();
    const timeoutTime = 5000;
    let state = 'Begin';
    let numOfAnswers = 0;
    let timeout;
    if (tid === 0) {
        sendCommitRequest();
        setInterval(sendCommitRequest, 1000);
        function sendCommitRequest () {
            MPI.broadcast({type: 'CanCommit', content: 'transaction'});
            state = 'Waiting';
            timeout = setTimeout(() => {
                MPI.broadcast({type: 'Abort', content: 'transaction'});
                state = 'Aborted';
            }, timeoutTime);
        }
        MPI.recv('Yes', (message) => {
            numOfAnswers++;
            if(numOfAnswers === MPI.size() - 1){
                numOfAnswers = 0;
                clearTimeout(timeout);
                MPI.broadcast({type: 'preCommit', content: 'transaction'});
                state = 'Prepared';
                timeout = setTimeout(() => {
                    MPI.broadcast({type: 'Abort', content: 'transaction'});
                    state = 'Aborted';
                }, timeoutTime);
            }
        })
        MPI.recv('No', (message) => {
            MPI.broadcast({type: 'Abort', content: 'transaction'});
            state = 'Aborted';
        })
        MPI.recv('ACK', (message) => {
            numOfAnswers++;
            if(numOfAnswers === MPI.size() - 1){
                numOfAnswers = 0;
                clearTimeout(timeout);
                MPI.broadcast({type: 'doCommit', content: 'transaction'});
                state = 'Commited';
            }
        });
    }
    else {
        MPI.recv('CanCommit', (message) => {
            timeout = setTimeout(abortHandler, timeoutTime);
            MPI.send(0, {type: 'Yes', content: 'transaction'});
            state = 'Waiting';
        })
        MPI.recv('abort', abortHandler);
        MPI.recv('preCommit', (message) => {
            clearTimeout(timeout);
            timeout = setTimeout(commitHandler, timeoutTime);
            MPI.send(0, {type: 'ACK', content: 'transaction'});
            state = 'Prepared';
        })
        MPI.recv('doCommit', commitHandler);
    }
    function commitHandler () {
        if (timeout) {
            clearTimeout(timeout);
        }
        state = 'Commited';
    }
    function abortHandler(message){
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        state = 'Aborted';
    }
```

[mpi-node-cli]: <https://www.npmjs.com/package/mpi-node-cli>
