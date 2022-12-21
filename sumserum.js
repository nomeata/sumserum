import { joinRoom } from 'https://cdn.skypack.dev/pin/trystero@v0.11.8-pxKZpWfVVzXootkGlZMp/mode=imports,min/optimized/trystero.js';
import { other, PLAYER1, PLAYER2, EMPTY, State, CHOOSE, SELECT, FINISHED, KEYS, GOOD, BAD } from './engine.js';


//
// UI elements
//

var c=document.getElementById("canvas");
var ctx=c.getContext("2d");

var foreground_pattern = '#55BF12';

var background_pattern;
var imageObj2 = new Image();
imageObj2.onload = function() {
	background_pattern = ctx.createPattern(imageObj2, 'repeat');
	if (state) draw_game();
};
imageObj2.src = 'wood_pattern.png';



// Some constants and enums
const STONE_SIZE=25;
const FIELD_WIDTH = STONE_SIZE * 2;
const FIELD_HEIGHT = STONE_SIZE  * 2;
const DIAGONAL = Math.pow(Math.pow(FIELD_WIDTH,2) + Math.pow(FIELD_HEIGHT,2), 0.5);
const WOOD = "#A68064";

const CENTER_X = c.width/2;
const CENTER_Y = 0.75*FIELD_HEIGHT + (c.height - 0.75*FIELD_HEIGHT)/2;

var local = [];
var state;
var tentative_state;
// state for online play
var room;
var opponent;
var sendMove;

draw_message("Welcome to Sum Serum.");

// Masterreset
function no_game() {
	state = undefined;
	tentative_state = undefined;
	ctx.clearRect(0, 0, c.width, c.height);

	if (room) room.leave();
	room = undefined;
        sendMove = undefined;
	opponent = undefined;
	document.getElementById("shareurl").style.display = "none";

}

// Start a game
function start_game(){
	// Does not configure local
	state = new State();
	tentative_state = state;
	state.restart_game();
	draw_game();
	c.focus();
	document.getElementById("shareurl").style.display = "none";
}

// Buttons
document.getElementById("playlocal").addEventListener("click", function () {
	if (state && state.phase != FINISHED) {
		if (!confirm("Do you really want to abort the current game?")) {
			return
		}
	}
	no_game();

	local[PLAYER1] = true;
	local[PLAYER2] = true;
	start_game();
});

// Play online
document.getElementById("playonline").addEventListener("click", function () {
	if (state && state.phase != FINISHED) {
		if (!confirm("Do you really want to abort current game?")) {
			return
		}
	}
	no_game();

	const roomid = (Math.random() + 1).toString(36).substring(7);
	room = joinRoom({appId: 'sumserum.nomeata.de'}, roomid)
        const [sendNewGame, _getNewGame] = room.makeAction('newGame')

	draw_message("Connecting...");

	var url = document.location.href.match(/(^[^#]*)/)[0];
	var game_url = url + "#" + roomid;
	document.getElementById("shareurl").value = game_url;
	document.getElementById("shareurl").style.display = "block";
	window.setTimeout(function() {document.getElementById("shareurl").select()}, 10);

        draw_message("Waiting for another player to join...");
        room.onPeerJoin(peerid => {
	  // Ignore if game is already in progress
	  if (state) { return }

          draw_message("Other player has joined...");
	  opponent = peerid;

          // I’m the first player, so I toss the coin
          const me = 1 + Math.floor(Math.random() * 2);
          const them = other(me)
          sendNewGame({you: them})

          const [sendMove_, getMove] = room.makeAction('move');
          sendMove = sendMove_;
          getMove(onMove);

          local[me] = true;
          local[them] = false;
          start_game();
        });
        room.onPeerLeave(peerid => {
	  if (peerid == opponent) {
	    no_game();
            draw_message("Your opponent has left the game.");
	  }
	});
});


// Related: join a game
{
	var roomid;
	var match = document.location.href.match(/#(.*)/);
	window.location.hash='';
	if (match) {roomid = match[1]};
	if (roomid) {
		console.log("Trying to join game " + roomid);
		draw_message("Connecting...");
		room = joinRoom({appId: 'sumserum.nomeata.de'}, roomid)

                const [_sendNewGame, getNewGame] = room.makeAction('newGame')
                getNewGame((msg, peerid) => {
		  opponent = peerid;
	          draw_message("Starting game...");
                  local[msg.you] = true;
                  local[other(msg.you)] = false;
                  const [sendMove_, getMove] = room.makeAction('move')
                  sendMove = sendMove_
                  getMove(onMove)
                  start_game();

		  room.onPeerLeave(peerid => {
		    if (peerid == opponent) {
		      no_game();
		      draw_message("Your opponent has left the game.");
		    }
		  });
                })
	}
}

window.addEventListener('beforeunload', function (e){
	if (state && state.phase != FINISHED) {
		e.returnValue = "You have an unfinished game running."
		return e.returnValue;
	}
});

function onMove(move) {
        // Opponent interaction
        state.on_interaction(move)
        draw_game();
};

function interact(input) {
	state.on_interaction(input);
	// Send interaction if this is a remote game
	if (sendMove && (local[PLAYER1] != local[PLAYER2])) sendMove(input);
	draw_game();
}

// Keyboard bindings
function keys(side) {
	// If side is the only local player, use 1-4 (the first set)
	if (local[side] && ! local[other(side)]) return KEYS[PLAYER1]
	// Otherwise, use both sets
	return KEYS[side]
}


// Positioning functions
function at_field(coords, action) {
	var n = coords[0];
	var m = coords[1];
	ctx.save();
	ctx.translate(
		CENTER_X +                        n * FIELD_HEIGHT/2 - m * FIELD_HEIGHT / 2,
		CENTER_Y + 7 * FIELD_HEIGHT / 2 - n * FIELD_HEIGHT/2 - m * FIELD_HEIGHT / 2 );
	action();
	ctx.restore();
}

function at_player_box(side, action) {
	ctx.save();
	if (side == PLAYER1) {
		ctx.translate(FIELD_WIDTH/2, FIELD_HEIGHT/2);
	} else {
		ctx.translate(500-FIELD_WIDTH/2-4*FIELD_WIDTH, FIELD_HEIGHT/2);
	}
	action();
	ctx.restore();
}

function at_count_box(side, action) {
	ctx.save();
	if (side == PLAYER1) {
		ctx.translate(FIELD_WIDTH/2, 350-FIELD_HEIGHT/2);
	} else {
		ctx.translate(500-FIELD_WIDTH/2-2*FIELD_WIDTH, 350-FIELD_HEIGHT/2);
	}
	action();
	ctx.restore();
}

function at_sel(n, action) {return function () {
	ctx.save();
	ctx.translate((n + 0.5) * FIELD_WIDTH, FIELD_HEIGHT/2);
	action();
	ctx.restore();
}}

// Drawing functions
function draw_background () {
	ctx.fillStyle=background_pattern;
	ctx.fillRect(0, 0, c.width, c.height);
}

function draw_field () {
	//ctx.strokeStyle="#FF0000";
	ctx.fillStyle=foreground_pattern;
	ctx.beginPath();
	ctx.moveTo(-FIELD_WIDTH/2,0);
	ctx.quadraticCurveTo(0, FIELD_HEIGHT/2, FIELD_WIDTH/2,0);
	ctx.quadraticCurveTo(0, -FIELD_HEIGHT/2, -FIELD_WIDTH/2,0);
	ctx.closePath();
	ctx.fill();
};

function player_color(side) {
	if (side == EMPTY) return "rgba(128,128,128,0.0)"; // "#C9A086";
	if (side == PLAYER1) return "#000000";
	if (side == PLAYER2) return "#FFFFFF";
	if (side == SOON_PLAYER1) return "rgba(0,0,0,0.5)";
	if (side == SOON_PLAYER2) return "rgba(255,255,255,0.5)";
	console.log('Invalid side: ' + side);
}

function player_color_tentative(side) {
	if (side == PLAYER1) return "rgba(0,0,0,0.5)";
	if (side == PLAYER2) return "rgba(255,255,255,0.5)";
	console.log('Invalid side: ' + side);
}

function gob_color(gob) {
	if (gob == GOOD) return "green";
	if (gob == BAD) return "red";
	console.log('Invalid gob: ' + gob);
}

function draw_halo (side) {return function() {
	ctx.save();
	ctx.fillStyle = player_color(side);
	ctx.shadowColor = player_color(side);
	ctx.shadowBlur = 8;
	ctx.shadowOffsetX = -1000;
	ctx.shadowOffsetY = 0;
	ctx.beginPath();
	ctx.arc(1000,0,STONE_SIZE/3, 0, 2*Math.PI);
	ctx.fill();
	ctx.restore();
}}

function draw_stone (side, tentative) {return function() {
	if (tentative)
		ctx.fillStyle = player_color_tentative(side);
	else
		ctx.fillStyle = player_color(side);
	ctx.beginPath();
	ctx.arc(0,0,STONE_SIZE/2, 0, 2*Math.PI);
	ctx.fill();
}}

function at_each_segment(line, action) {
	var m = line[0][0];
	var n = line[0][1];
	var m2 = line[1][0];
	var n2 = line[1][1];
	if (m == m2) {
		// Top left to bottom right
		if (n2 < n) { var tmp = n; n = n2 ; n2 = tmp }
		while (n < n2) {
			at_field([m, n], function () {
				ctx.rotate(-45*Math.PI/180);
				action();
			})
			n++;
		}
	} else {
		// Bottom left to top right
		if (m2 < m) { var tmp = m; m = m2 ; m2 = tmp }
		while (m < m2) {
			at_field([m, n], function () {
				ctx.rotate(45*Math.PI/180);
				action();
			})
			m++;
		}
	}
}

function draw_line(side, gob, line) {
	at_each_segment(line, function () {
		ctx.fillStyle = player_color(side);
		ctx.beginPath();
		ctx.moveTo( STONE_SIZE/2 / Math.pow(2,0.5),
		           -STONE_SIZE/2 / Math.pow(2,0.5));
		ctx.quadraticCurveTo(
			    0,
			   -DIAGONAL/4,
			    STONE_SIZE/2 / Math.pow(2,0.5),
		           -DIAGONAL/2
		           +STONE_SIZE/2 / Math.pow(2,0.5));
		ctx.lineTo(
			   -STONE_SIZE/2 / Math.pow(2,0.5),
		           -DIAGONAL/2
		           +STONE_SIZE/2 / Math.pow(2,0.5));
		ctx.quadraticCurveTo(
			    0,
			   -DIAGONAL/4,
			   -STONE_SIZE/2 / Math.pow(2,0.5),
		           -STONE_SIZE/2 / Math.pow(2,0.5));
		ctx.closePath;
		ctx.fill();
	})
	ctx.strokeStyle = gob_color(gob);
	ctx.beginPath();
	ctx.lineWidth = STONE_SIZE/6;
	ctx.lineCap="round";
	at_field(line[0], function() {ctx.moveTo(0,0)});
	at_field(line[1], function() {ctx.lineTo(0,0)});
	ctx.stroke();
}

function draw_player_box(side) {return function (){
	ctx.fillStyle=foreground_pattern;
	ctx.beginPath();
	ctx.lineJoin="round";
	//ctx.moveTo(FIELD_HEIGHT/2, FIELD_HEIGHT);
	ctx.arc(FIELD_HEIGHT/2, FIELD_HEIGHT/2,
	        FIELD_HEIGHT/2, 0.5*Math.PI, 1.5*Math.PI);
	ctx.lineTo(4*FIELD_WIDTH - FIELD_HEIGHT/2, 0);
	ctx.arc(4*FIELD_WIDTH - FIELD_HEIGHT/2, FIELD_HEIGHT/2,
	        FIELD_HEIGHT/2, 1.5*Math.PI, 0.5*Math.PI);
	ctx.closePath();
	ctx.fill();
}}

function draw_count_box(side) {return function (){
	ctx.fillStyle=foreground_pattern;
	ctx.beginPath();
	ctx.lineJoin="round";
	//ctx.moveTo(FIELD_HEIGHT/2, FIELD_HEIGHT);
	ctx.arc(FIELD_HEIGHT/2, FIELD_HEIGHT/2,
	        FIELD_HEIGHT/2, 0.5*Math.PI, 1.5*Math.PI);
	ctx.lineTo(2*FIELD_WIDTH - FIELD_HEIGHT/2, 0);
	ctx.arc(2*FIELD_WIDTH - FIELD_HEIGHT/2, FIELD_HEIGHT/2,
	        FIELD_HEIGHT/2, 1.5*Math.PI, 0.5*Math.PI);
	ctx.closePath();
	ctx.fill();
}}

function draw_text(side, txt) {return function() {
	ctx.fillStyle = player_color(side);
	ctx.font = (0.5*FIELD_HEIGHT) + 'px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillText(txt, 2 * FIELD_WIDTH, 0.85 * FIELD_HEIGHT);
}}

function draw_message(msg) {
	ctx.clearRect(0, 0, c.width, c.height);
	ctx.fillStyle = player_color(PLAYER1);
	ctx.font = (0.5*FIELD_HEIGHT) + 'px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'bottom';
	ctx.fillText(msg, CENTER_X,CENTER_Y);
}

function draw_key(side, i) {return function() {
	draw_stone(side)();
	var txt = keys(side)[i];
	ctx.fillStyle = player_color(other(side));
	ctx.font = (0.8*STONE_SIZE) + 'px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(txt, 0, 0.1*STONE_SIZE);
}}

function draw_player_count(side) {return function() {
	ctx.save();
	ctx.translate(1.2 * FIELD_WIDTH, FIELD_HEIGHT/2);
	var txt = state.stones_left(side)+ "×";
	ctx.fillStyle = player_color(side);
	ctx.font = (0.8*STONE_SIZE) + 'px sans-serif';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	ctx.fillText(txt, 0, 0.1*STONE_SIZE);
	ctx.translate(0.3*FIELD_WIDTH, 0);
	draw_stone(side)();
	ctx.restore();
}}

function draw_player_input(side) {return function (){
	var upto = state.available_stones(side);
	for (var i = 0; i < upto ; i++) {
		at_sel(i, draw_key(side, i))();
	}
}}

function draw_player_selection(side) {return function (){
	for (var i = 0; i < 4 ; i++) {
		if (state.placed[side] <= i && i < tentative_state.placed[side]) {
			at_sel(i, draw_stone(side,true))();
		} else if (state.placed[side] <= i && i < state.chosen[side]) {
			at_sel(i, draw_stone(side))();
		} else {
			// at_sel(i, draw_stone(EMPTY))();
		}
	}
}}

function draw_game() {
	ctx.clearRect(0, 0, c.width, c.height);
	draw_background();
	state.board.forEach(function (row, m) {
		row.forEach(function (player, n) {
			at_field([m, n], draw_field);
			at_field([m, n], draw_stone(
				tentative_state.at([m,n]),
				state.at([m,n]) != tentative_state.at([m,n])
				));
			if (may_choose() &&  tentative_state.is_valid_field([m,n])) {
				at_field([m,n], draw_halo(state.to_place()[0]));
			}
		});
	});
	for (var side = PLAYER1; side <= PLAYER2; side++) {
		at_player_box(side, draw_player_box(side));
		if (state.phase == FINISHED) {
			var g = state.sumlength(state.good[side]);
			var b = state.sumlength(state.bad[side]);
			var total = g - b;
			at_player_box(side, draw_text(side, g + " \u2212 " + b + " = " + total));
		} else if (state.phase == CHOOSE) {
			// Never show remote stuff here
			if (local[side]){
				if (state.chosen[side] == 0) {
					at_player_box(side, draw_player_input(side));
				}
				// Only show the selected stuff in a remote game
				if (state.chosen[side] > 0 && !local[other(side)]) {
					at_player_box(side, draw_player_selection(side));
				}
			}
		} else {
			at_player_box(side, draw_player_selection(side));
		}

		state.bad[side].forEach(function (line) {
			draw_line(side, BAD, line);
		})
		state.good[side].forEach(function (line) {
			draw_line(side, GOOD, line);
		})
	}
	for (var side = PLAYER1; side <= PLAYER2; side++) {
		at_count_box(side, draw_count_box(side));
		at_count_box(side, draw_player_count(side));
	}
}


// Global to local
function to_canvas(coords) {
        var rect = canvas.getBoundingClientRect();
	return [ coords[0] - rect.left, coords[1] - rect.top ];
}

// Coordinate to field
function to_field(coords) {
	var x = coords[0];
	var y = coords[1];
	var m =    (x - CENTER_X)                   /FIELD_WIDTH
	         - (y - CENTER_Y - 7*FIELD_HEIGHT/2)/FIELD_HEIGHT;
	var n =  - (x - CENTER_X)                   /FIELD_WIDTH
	         - (y - CENTER_Y - 7*FIELD_HEIGHT/2)/FIELD_HEIGHT;
	if (Math.pow(m - Math.round(m), 2) + Math.pow(n - Math.round(n), 2) < 1/8) {
		m = Math.round(m);
		n = Math.round(n);
		if (m >= 0 && m < 7 && n >= 0 && n < 7 &&
		   !(m == 0 && n == 0) && !(m == 6 && n == 6)) {
			return [m,n];
		}
	}
	return undefined;
}
// Coordinate to selector
function to_sel(coords) {
	var x = coords[0];
	var y = coords[1];

	// Player 1
	var i =    (x - FIELD_WIDTH/2  - FIELD_WIDTH/2)  / FIELD_WIDTH;
	var j =  - (y - FIELD_HEIGHT/2 - FIELD_HEIGHT/2) / FIELD_HEIGHT;
	if (Math.pow(i - Math.round(i), 2) + Math.pow(j - Math.round(j), 2) < 1/8) {
		i = Math.round(i);
		j = Math.round(j);
		if (i >= 0 && i < 4 && j == 0) {
			return { what: 'sel'
			       , side: PLAYER1
			       , n : i + 1};
		}
	}

	// Player 2
	var i =    (x - (500 - FIELD_WIDTH/2  - FIELD_WIDTH/2 - 3*FIELD_WIDTH))/ FIELD_WIDTH;
	var j =  - (y - FIELD_HEIGHT/2 - FIELD_HEIGHT/2) / FIELD_HEIGHT;
	if (Math.pow(i - Math.round(i), 2) + Math.pow(j - Math.round(j), 2) < 1/8) {
		i = Math.round(i);
		j = Math.round(j);
		if (i >= 0 && i < 4 && j == 0) {
			return { what: 'sel'
			       , side: PLAYER2
			       , n : i + 1};
		}
	}

	return undefined;
}



// Event handling

function may_choose() {
	return (state && state.phase == SELECT && local[state.to_place()[0]]);
}

var last_hover = undefined;
c.addEventListener('mousemove', function(evt) {
	if (may_choose()) {
		var field = to_field(to_canvas([evt.clientX, evt.clientY]));
		if (field == last_hover
			|| (field && last_hover && field[0] == last_hover[0] && field[1] == last_hover[1])) {
			;
		} else {
			if (state) {
				tentative_state = state;
				if (field) {
					tentative_state = state.clone();
					tentative_state.on_interaction({what: 'field', field:field});
				}
				draw_game()
			}

			last_hover = field;
		}
	}
});
c.addEventListener('mousedown', function(evt) {
	if (may_choose()) {
		var field = to_field(to_canvas([evt.clientX, evt.clientY]));
		if (field) {
			tentative_state = state;
			var input = {what: 'field', field:field};
			interact(input);
			return
		}
	}

	var sel = to_sel(to_canvas([evt.clientX, evt.clientY]));
	if (sel && local[sel.side] && sel.n <= state.available_stones(sel.side)) {
		interact(sel);
		return
	}

	if (state && state.phase == FINISHED) {
		var input = {what: 'other'};
		interact(input);
	}
});
c.addEventListener('keypress', function(evt) {
	var key;
	if (evt.charCode == 49) key = '1';
	if (evt.charCode == 50) key = '2';
	if (evt.charCode == 51) key = '3';
	if (evt.charCode == 52) key = '4';
	if (evt.charCode == 117) key = 'U';
	if (evt.charCode == 105) key = 'I';
	if (evt.charCode == 111) key = 'O';
	if (evt.charCode == 112) key = 'P';
	if (key) {
		var input;
		for (var side = PLAYER1; side <= PLAYER2; side++) {
			var i = keys(side).indexOf(key);
			if (i >= 0)
				input = { what: 'sel', side: side, n: i + 1};
		}

		if (input && local[input.side]) {
			interact(input);
			evt.preventDefault();
		}
	} else {
		//console.log(evt.charCode, key);
	}
});
