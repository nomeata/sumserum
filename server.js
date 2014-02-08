var port = process.env.OPENSHIFT_NODEJS_PORT || 9999;
var ip   = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var http = require('http');
var sockjs = require('sockjs');
var node_static = require('node-static');
var uuid = require('node-uuid');

// 1. Echo sockjs server
var sockjs_opts = {sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js"};

// key to client connection
var clients = {};

// game id to waiting player
var waiting = {};
// waiting player to game id
var waiting_clients = {};

// Mapping from id to opponent's id
var opp = {};

function broadcast(from, message) {
	for(key in clients) if(clients.hasOwnProperty(key)) {
		if (key != from) clients[key].write(message);
        }
}

function send(to, dict) {
	clients[to].write(JSON.stringify(dict));
}

function error(to, message) {
	send(to, {meta: "error", error: message});
}

function hookup(p1, p2) {
	console.log("Trying to hook up " + p1 + " and " + p2);
	opp[p1] = p2;
	opp[p2] = p1;
	send(p1, {meta: "newgame", you: 1});
	send(p2, {meta: "newgame", you: 2});
}

var sockjs = sockjs.createServer(sockjs_opts);

sockjs.on('connection', function(conn) {
	clients[conn.id] = conn;

	conn.on('data', function(message) {
		msg = JSON.parse(message);
		var meta;
		if (meta = msg.meta) {
			console.log(conn.id, msg);
			if (meta == "hookmeup") {
				if (waiting_clients.hasOwnProperty(conn.id)) {
					var gameid = waiting_clients[conn.id];
					delete waiting[gameid];
					delete waiting_clients[conn.id];
				}
				var gameid = uuid().substr(0,8);

				console.log('New waiting game ' + gameid + ' for ' + conn.id);
				waiting[gameid] = conn.id;
				waiting_clients[conn.id] = gameid;

				send(conn.id, {meta: "gameid", gameid: gameid});
			} else if (meta == "join") {
				if (waiting_clients.hasOwnProperty(conn.id)) {
					var gameid = waiting_clients[conn.id];
					delete waiting[gameid];
					delete waiting_clients[conn.id];
				}
				var gameid = msg.gameid;

				console.log('Player ' + conn.id + 'wants to join game ' + gameid);
				if (waiting.hasOwnProperty(gameid)) {
					var oppid = waiting[gameid];
					hookup(oppid, conn.id);
					delete waiting[gameid];
					delete waiting_clients[oppid];
				} else {
					error (conn.id, "No such game to join.");
				}
			} else {
				error(conn.id, "Unknown command " + meta);
			}
		} else {
			if (opp.hasOwnProperty(conn.id)) {
				clients[opp[conn.id]].write(message);
			} else {
				error(conn.id, "Not in a game.");
			}
		}
	});

	conn.on('close', function() {
		console.log('closed', conn.id);
		if (opp.hasOwnProperty(conn.id)){
			send(opp[conn.id], {meta:"left" });
			delete opp[opp[conn.id]];
			delete opp[conn.id];
		}
		if (waiting_clients.hasOwnProperty[conn.id]) {
			var gameid = waiting_clients[conn.id];
			delete waiting_clients[conn.id];
			delete waiting[gameid];
		}
		delete clients[conn.id];
	});
});

// 2. Static files server
var static_directory = new node_static.Server(__dirname+"/client");

// 3. Usual http stuff
var server = http.createServer();
server.addListener('request', function(req, res) {
    static_directory.serve(req, res);
});
server.addListener('upgrade', function(req,res){
    res.end();
});

sockjs.installHandlers(server, {prefix:'/game'});

console.log(' [*] Listening on http://' + ip + ':' + port + '/');
server.listen(port, ip);
