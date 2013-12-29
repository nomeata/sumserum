//
// The engine (i.e. game state,  game mechanics, UI hooks)
//


// Some constants and enums
EMPTY = 0;
PLAYER1 = 1;
PLAYER2 = 2;
GOOD = 1;
BAD = 2;

var KEYS = [];
KEYS[PLAYER1] = ['1','2','3','4'];
KEYS[PLAYER2] = ['U','I','O','P'];

// Phases
var CHOOSE = 1;
var SELECT = 2;
var FINISHED = 3;


// Game state

function State(){
}

State.prototype.restart_game = function() {
	this.current_side = PLAYER1;
	this.phase = CHOOSE;
	this.board = this.empty_board();
	this.chosen = [];
	this.chosen[PLAYER1] = 0;
	this.chosen[PLAYER2] = 0;
	this.placed=[];
	this.placed[PLAYER1] = 0;
	this.placed[PLAYER2] = 0;

	this.good = [];
	this.good[PLAYER1] = [];
	this.good[PLAYER2] = [];
	this.bad = [];
	this.bad[PLAYER1] = [];
	this.bad[PLAYER2] = [];
};

State.prototype.clone = function () {
	var clone = new State();
	var props = deepcopy(this);
	for (p in props){
		clone[p] = props[p];
	}
	return clone;
};

// Game mechanics
State.prototype.to_phase = function (new_phase) {
	if (new_phase == CHOOSE) {
		this.chosen[PLAYER1] = 0;
		this.chosen[PLAYER2] = 0;
		this.placed[PLAYER1] = 0;
		this.placed[PLAYER2] = 0;
		this.phase = CHOOSE;
	}
	if (new_phase == SELECT) {
		if (this.chosen[PLAYER1] < this.chosen[PLAYER2]) {
			this.current_side = PLAYER1
		} else if (this.chosen[PLAYER2] < this.chosen[PLAYER1]) {
			this.current_side = PLAYER2
		}
		this.phase = SELECT;
	}
	if (new_phase == FINISHED) {
		this.tally();
		this.phase = FINISHED;
	}
};



// A list of stones left to place.
State.prototype.to_place = function () {
	var ret = []
	for (var i = 0; i < this.chosen[this.current_side] - this.placed[this.current_side]; i++)
		ret.push(this.current_side);
	for (var i = 0; i < this.chosen[other(this.current_side)] - this.placed[other(this.current_side)]; i++)
		ret.push(other(this.current_side));
	return ret;
};

// Reacting on user interaction
State.prototype.on_interaction = function(input){
	if (input.what ==  "sel") {
		if (this.phase == CHOOSE) {
			this.chosen[input.side] = input.n;
			if (this.chosen[PLAYER1] > 0 && this.chosen[PLAYER2] > 0) {
				this.to_phase(SELECT);
			}
		}

	}
	if (input.what == "field") {
		var field = input.field;
		if (this.phase == SELECT) {
			var row_rest = this.is_valid_field(field);
			if (row_rest) {
				var field, player;
				var todo = this.to_place();
				while ((field = row_rest.shift()) && (side = todo.shift())){
					this.board[field[0]][field[1]] = side;
					this.placed[side]++;
				}

				if (this.is_game_finished()) {
					this.to_phase(FINISHED)
				}

				if (this.placed[PLAYER1] == this.chosen[PLAYER1] &&
				    this.placed[PLAYER2] == this.chosen[PLAYER2]) {
					this.to_phase(CHOOSE);
				}
			}
		}
	}
	if (input.what == "other") {
		if (this.phase == FINISHED) {
			this.restart_game();
		}
	}
};

// An empty board
State.prototype.empty_board = function () {
	var board = [];
	for (m = 0 ; m < 7; m++) {
		if (!board[m]) board[m] = [];
		for (n = 0 ; n < 7; n++) {
			if (m == 0 && n == 0 || m == 6 && n == 6) continue;
			// board[m][n] = 1 + Math.floor( 2 * Math.random());
			board[m][n] = EMPTY;
		}
	}
	return board;
};

// Tallying the result
State.prototype.tally = function () {
	// Top left to bottom right
	for (var m = 0; m < 7; m++) {
		var i = 0;
		if (m == 0) i = 1;
		for (var n = i+1; n <= 7; n++) {
			if (n == 7 || m == 6 && n == 6 || this.at([m,n]) != this.at([m,i])) {
				if (n - i == 3) {
					this.good[this.at([m,i])].push([[m,i], [m,n-1]]);
				}
				if (n - i > 3) {
					this.bad[this.at([m,i])].push([[m,i], [m,n-1]]);
				}
				i = n;
			}
		}
	}
	// Bottom left to top right
	for (var n = 0; n < 7; n++) {
		var i = 0;
		if (n == 0) i = 1;
		for (var m = i+1; m <= 7; m++) {
			if (m == 7 || n == 6 && m == 6 || this.at([m,n]) != this.at([i,n])) {
				if (m - i == 3) {
					this.good[this.at([i,n])].push([[i,n], [m-1,n]]);
				}
				if (m - i > 3) {
					this.bad[this.at([i,n])].push([[i,n], [m-1,n]]);
				}
				i = m;
			}
		}
	}
};

State.prototype.at = function(coord) {
	return this.board[coord[0]][coord[1]];
}

State.prototype.is_empty = function(coord) {
	var side = this.at(coord)
	return !(side == PLAYER1 || side == PLAYER2);
}

State.prototype.sumlength = function(rows) {
	var res = 0;
	rows.forEach(function (r) {
		res += r[1][0] - r[0][0] + r[1][1] - r[0][1] + 1
	});
	return res;
}

// All rows, and their coordinates
State.prototype.rows = (function() {
	var rows = [];
	for (var i = 1; i< 12; i++) { // 5 rows, from bottom to top
		row = [];
		for (var j = 0; j < Math.min(i + 1, 13 - i) ; j++) {
			row[j] = [Math.max(0, i - 6) + j,
			         Math.min(i, 6)     - j];
		}
		rows.push(row);
	}
	return rows;
})();

State.prototype.valid_rows = function () {
	var valid_rows = [];
	for (var i = 0; i < this.rows.length; i++) {
		if (this.is_empty(this.rows[i][0]) &&
		    this.is_empty(this.rows[i][this.rows[i].length - 1])) {
			// Row is empty?
			valid_rows.push(this.rows[i].slice());
			valid_rows.push(this.rows[i].slice().reverse());
		}
		else if (!this.is_empty(this.rows[i][0]) &&
		    !this.is_empty(this.rows[i][this.rows[i].length - 1])) {
			// Row is full
		}
		// Partial row!
		else if (this.is_empty(this.rows[i][0])) {
			// Filled from the right
			for (var j = 0; this.is_empty(this.rows[i][j]); j++) {
			}
			return [ this.rows[i].slice(0,j).reverse() ];
		}
		else if (this.is_empty(this.rows[i][this.rows[i].length - 1])) {
			// Filled from the left
			for (var j = this.rows[i].length - 1; this.is_empty(this.rows[i][j]); j--) {
			}
			return [ this.rows[i].slice(j+1) ];
		}

	}
	return valid_rows;
}

State.prototype.is_game_finished = function() {
	return this.valid_rows().length == 0;
}

// All the coordinates of the row of one field
State.prototype.row_of = function(field) {
	var m = field[0];
	var n = field[1];
	var row = [];
	return row;
}

// Check if something can be placed here
State.prototype.is_valid_field = function (field) {
	if (this.phase == SELECT) {
		var vrows = this.valid_rows();
		for (var i = 0; i < vrows.length; i++) {
			if (vrows[i][0][0] == field[0] && vrows[i][0][1] == field[1]) {
				return vrows[i].slice();
			}
		}
	}
	return undefined;
}


// Utilities
function deepcopy(x) {return JSON.parse(JSON.stringify(x))}
function and(f1,f2) {return function() { f1(); f2() } }

function other(side) {
	if (side == PLAYER1) return PLAYER2;
	if (side == PLAYER2) return PLAYER1;
}

