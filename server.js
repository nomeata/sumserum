var port = process.env.OPENSHIFT_NODEJS_PORT || 9999;
var ip   = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var http = require('http');
var sockjs = require('sockjs');
var node_static = require('node-static');

// 1. Echo sockjs server
var sockjs_opts = {sockjs_url: "http://cdn.sockjs.org/sockjs-0.3.min.js"};

var clients = {};

// An id, or no idea
var waiting;

// Mapping from id to opponent's id
var opp = {};

function broadcast(from, message) {
	for(key in clients) if(clients.hasOwnProperty(key)) {
		if (key != from) clients[key].write(message);
        }
}

function error(to, message) {
	clients[to].write(JSON.stringify({meta: "error", error: message}));
}

function hookup(p1, p2) {
	opp[p1] = p2;
	opp[p2] = p1;
	clients[p1].write(JSON.stringify({meta: "newgame", you: 1}));
	clients[p2].write(JSON.stringify({meta: "newgame", you: 2}));
	waiting = undefined;
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
				if (waiting && waiting != conn.id) {
					hookup(waiting, conn.id);
				} else {
					waiting = conn.id;
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
			clients[opp[conn.id]].write(JSON.stringify({meta:"left" }));
			delete opp[opp[conn.id]];
			delete opp[conn.id];
		}
		if (waiting == conn.id) waiting = undefined;
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

console.log(' [*] Listening on ' + ip + ':' + port );
server.listen(port, ip);
