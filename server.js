const PORT = process.env.PORT || 3000;
// SOCKET.IO VARIABLES
var io = require('socket.io');
var async = require('async');
var server = io.listen(PORT);
var gameserver = server.of('/game');
var chatserver = server.of('/chat');

var connectedUsers = [];
let run = {};
let loopStartTime;
let loopEndTime;
let waitTime;
let rooms = [];
let roomsPlayers = {};
console.log(`Now listening on port ${ PORT }`);

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

 function runGameLoop(room){
    async.whilst(
        function (callbackFunction) {
            // start loop
            loopStartTime = Date.now();
            // console.log(run[room]);
            callbackFunction(null, run[room] >= 0);
        },
        function (callback) {
            //console.log(Date.now());
            //logic
            for(i=0;i<roomsPlayers[room].length;i++){
                var tempUser = connectedUsers[roomsPlayers[room][i]];
                
                //Update current ghost
                if(!tempUser.ghosts[tempUser.ghostCount]){
                    tempUser.ghosts[tempUser.ghostCount] = [];
                }
                tempUser.ghosts[tempUser.ghostCount].push(tempUser.coords);
                var tempUserTickOffset = run[room] - tempUser.tickTime;
                //Broadcast previous ghosts
                if(tempUser.ghostCount>0){
                    var ghostBundle = [];
                    for(j=0;j<tempUser.ghostCount;j++){
                        if(tempUser.ghosts[j][tempUserTickOffset]){
                            ghostBundle.push([j,tempUser.ghosts[j][tempUserTickOffset]])
                        }
                    }
                    var ghostData = {};
                    ghostData.player = roomsPlayers[room][i];
                    ghostData.amount = tempUser.ghostCount;
                    ghostData.ghostBundle = ghostBundle;
                    gameserver.to(room).emit('ghosts', ghostData);
                }
                //console.log(connectedUsers[Object.keys(connectedUsers)[i]]);
            }
            // end loop
            run[room]++;
            loopEndTime = Date.now();
            waitTime = 25 - (loopEndTime - loopStartTime);
            setTimeout(callback, waitTime);
        }
    )
 }


// USER CONNECT
gameserver.on('connection', function(socket) {
    // JOIN ROOM 
    socket.on('join room', function(joinData) {
        if(joinData.room == false){
            var room = 0;
            var roomIdLength = 4;
            while(room === 0 || rooms.includes(room)){
                room = makeid(roomIdLength);
                roomIdLength++;
            }
            console.log("new room");
            
        } else {
            var room = joinData.room;
            console.log("joined room");
        }

        var clientData = {};
        clientData.id = socket.id;
        clientData.room = room;
        socket.emit('connected', clientData);
        console.log(clientData);
        if(!rooms.includes(room)){
            rooms.push(room);
            roomsPlayers[room] = [];
        }
        if(!roomsPlayers[room].includes(socket.id)){
            roomsPlayers[room].push(socket.id);
        }
        socket.join(room);
        connectedUsers[socket.id] = {};
        connectedUsers[socket.id].ghosts = [];
        connectedUsers[socket.id].ghostCount = 0;
        connectedUsers[socket.id].lastReset = 0;
        connectedUsers[socket.id].room = room;
        //console.log(socket.id + " joined the room!")

        // Start game loop
        if(joinData.room == false){
            run[room] = 0;
            runGameLoop(room);
        }
    });
    socket.on('player move', function(move) {
        if(connectedUsers[socket.id]){
            connectedUsers[socket.id].coords = move;
        }
    });
    socket.on('reset', function(save){
        if(Date.now()-connectedUsers[socket.id].lastReset>500){
            connectedUsers[socket.id].lastReset = Date.now();
            if(save===true){
                connectedUsers[socket.id].ghostCount++;  
            } else if(save===false) {
                delete connectedUsers[socket.id].ghosts[connectedUsers[socket.id].ghostCount];
            } else {
                for(i=connectedUsers[socket.id].ghostCount-1;i>=save;i--){
                    connectedUsers[socket.id].ghosts.splice(i, 1);
                }
                // connectedUsers[socket.id].ghosts
                connectedUsers[socket.id].ghostCount = save+1;
            }
            connectedUsers[socket.id].tickTime = run[connectedUsers[socket.id].room];
            var resetData = {};  
            resetData.id = socket.id;
            gameserver.to(connectedUsers[socket.id].room).emit('reset', resetData);
        }
    })
    // DISCONNECT
    socket.on('disconnect', function() {
        if(connectedUsers[socket.id]){
            console.log("disconnect");
            for( var i = 0; i < roomsPlayers[connectedUsers[socket.id].room].length; i++){ 
                if ( roomsPlayers[connectedUsers[socket.id].room][i] === socket.id) {
                    roomsPlayers[connectedUsers[socket.id].room].splice(i, 1); 
                }
             }
            delete connectedUsers[socket.id]
        }

    });
});