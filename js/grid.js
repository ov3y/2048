function Grid(size, previousState) {
  this.size = size;
  this.startTiles   = 2;
  this.cells = previousState ? this.fromState(previousState) : this.empty();
  this.playerTurn = true;
}

// pre-allocate these objects (for speed)
Grid.prototype.indexes = [];
for (var x=0; x<4; x++) {
  Grid.prototype.indexes.push([]);
  for (var y=0; y<4; y++) {
    Grid.prototype.indexes[x].push( {x:x, y:y} );
  }
}

// Build a grid of the specified size
Grid.prototype.empty = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }

  return cells;
};

Grid.prototype.fromState = function (state) {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      var tile = state[x][y];
      row.push(tile ? new Tile(tile.position, tile.value) : null);
    }
  }

  return cells;
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];
  var self = this;

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      //cells.push(self.indexes[x][y]);
      cells.push( {x:x, y:y} );
    }
  });

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};

Grid.prototype.clone = function() {
  newGrid = new Grid(this.size);
  newGrid.playerTurn = this.playerTurn;
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      if (this.cells[x][y]) {
        newGrid.insertTile(this.cells[x][y].clone());
      }
    }
  }
  return newGrid;
};

Grid.prototype.serialize = function () {
  var cellState = [];

  for (var x = 0; x < this.size; x++) {
    var row = cellState[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null);
    }
  }

  return {
    size: this.size,
    cells: cellState
  };
};

// Set up the initial tiles to start the game with
Grid.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
Grid.prototype.addRandomTile = function () {
  if (this.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.randomAvailableCell(), value);

    this.insertTile(tile);
  }
};

// Save all tile positions and remove merger info
Grid.prototype.prepareTiles = function () {
  this.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
Grid.prototype.moveTile = function (tile, cell) {
  this.cells[tile.x][tile.y] = null;
  this.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
Grid.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;
  var score      = 0;
  var won        = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  for (var i=0; i<traversals.x.length; i++) {
    var x = traversals.x[i];
    for (var j=0; j<traversals.y.length; j++) {
      var y = traversals.y[j];
      var cell = self.indexes[x][y];
      tile = self.cells[x][y];

      if (tile) {
        //if (debug) {
          //console.log('tile @', x, y);
        //}
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.insertTile(merged);
          self.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) won = true;
        } else {
          //if (debug) {
            //console.log(cell);
            //console.log(tile);
          //}
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          self.playerTurn = false;
          //console.log('setting player turn to ', self.playerTurn);
          moved = true; // The tile moved from its original cell!
        }
      }
    };
  };

  //console.log('returning, playerturn is', self.playerTurn);
  //if (!moved) {
    //console.log('cell', cell);
    //console.log('tile', tile);
    //console.log('direction', direction);
    //console.log(this.toString());
  //}
  return {moved: moved, score: score, won: won};
};

Grid.prototype.vectors = {
  0: { x: 0,  y: -1 }, // up
  1: { x: 1,  y: 0 },  // right
  2: { x: 0,  y: 1 },  // down
  3: { x: -1, y: 0 }   // left
}

// Get the vector representing the chosen direction
Grid.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  return this.vectors[direction];
};

Grid.prototype.computerMove = function() {
  this.addRandomTile();
  this.playerTurn = true;
}

// Build a list of positions to traverse in the right order
Grid.prototype.buildTraversals = function (vector) {
  var travX = [], travY = [];


  for (var pos = 0; pos < this.size; pos++) {
    travX.push(pos);
    travY.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) travX = travX.reverse();
  if (vector.y === 1) travY = travY.reverse();

  return { x: travX, y: travY };
};

Grid.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.withinBounds(cell) &&
           this.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

Grid.prototype.movesAvailable = function () {
  return this.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
Grid.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

Grid.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

Grid.prototype.toString = function() {
  string = '';
  for (var i=0; i<4; i++) {
    for (var j=0; j<4; j++) {
      if (this.cells[j][i]) {
        string += this.cells[j][i].value + ' ';
      } else {
        string += '_ ';
      }
    }
    string += '\n';
  }
  return string;
}

// counts the number of isolated groups.
Grid.prototype.islands = function() {
  var self = this;
  var mark = function(x, y, value) {
    if (x >= 0 && x <= 3 && y >= 0 && y <= 3 &&
        self.cells[x][y] &&
        self.cells[x][y].value == value &&
        !self.cells[x][y].marked ) {
      self.cells[x][y].marked = true;

      for (direction in [0,1,2,3]) {
        var vector = self.getVector(direction);
        mark(x + vector.x, y + vector.y, value);
      }
    }
  }

  var islands = 0;

  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      if (this.cells[x][y]) {
        this.cells[x][y].marked = false
      }
    }
  }
  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      if (this.cells[x][y] &&
          !this.cells[x][y].marked) {
        islands++;
        mark({ x:x, y:y }, this.cells[x][y].value);
      }
    }
  }

  return islands;
}


// measures how smooth the grid is (as if the values of the pieces
// were interpreted as elevations). Sums of the pairwise difference
// between neighboring tiles (in log space, so it represents the
// number of merges that need to happen before they can merge).
// Note that the pieces can be distant
Grid.prototype.smoothness = function() {
  var smoothness = 0;
  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      var tile = this.cells[x][y];
      if (tile) {
        var value = Math.log(tile.value);
        for (var direction=1; direction<=2; direction++) {
          var vector = this.getVector(direction);
          var targetCell = this.findFarthestPosition(this.indexes[x][y], vector).next;
          if (this.withinBounds(targetCell)) {
            var target = this.cells[targetCell.x][targetCell.y];
            if (target) {
              smoothness -= Math.abs(value - Math.log(target.value));
            }
          }
        }
      }
    }
  }
  return smoothness / Math.log(2);
}

Grid.prototype.monotonicity = function() {
  var self = this;
  var marked = [];
  var queued = [];
  var highestValue = 0;
  var highestCell = {x:0, y:0};
  for (var x=0; x<4; x++) {
    marked.push([]);
    queued.push([]);
    for (var y=0; y<4; y++) {
      marked[x].push(false);
      queued[x].push(false);
      if (this.cells[x][y] &&
          this.cells[x][y].value > highestValue) {
        highestValue = this.cells[x][y].value;
        highestCell.x = x;
        highestCell.y = y;
      }
    }
  }

  increases = 0;
  cellQueue = [highestCell];
  queued[highestCell.x][highestCell.y] = true;
  markList = [highestCell];
  markAfter = 1; // only mark after all queued moves are done, as if searching in parallel

  var markAndScore = function(cell) {
    markList.push(cell);
    var value;
    if (self.cellOccupied(cell)) {
      value = Math.log(self.cellContent(cell).value) / Math.log(2);
    } else {
      value = 0;
    }
    for (direction in [0,1,2,3]) {
      var vector = self.getVector(direction);
      var target = { x: cell.x + vector.x, y: cell.y+vector.y }
      if (self.withinBounds(target) && !marked[target.x][target.y]) {
        if ( self.cellOccupied(target) ) {
          targetValue = Math.log(self.cellContent(target).value ) / Math.log(2);
          if ( targetValue > value ) {
            //console.log(cell, value, target, targetValue);
            increases += targetValue - value;
          }
        }
        if (!queued[target.x][target.y]) {
          cellQueue.push(target);
          queued[target.x][target.y] = true;
        }
      }
    }
    if (markAfter == 0) {
      while (markList.length > 0) {
        var cel = markList.pop();
        marked[cel.x][cel.y] = true;
      }
      markAfter = cellQueue.length;
    }
  }

  while (cellQueue.length > 0) {
    markAfter--;
    markAndScore(cellQueue.shift())
  }

  return -increases;
}

// measures how monotonic the grid is. This means the values of the tiles are strictly increasing
// or decreasing in both the left/right and up/down directions
Grid.prototype.monotonicity2 = function() {
  // scores for all four directions
  var totals = [0, 0, 0, 0];

  // up/down direction
  for (var x=0; x<4; x++) {
    var current = 0;
    var next = current+1;
    while ( next<4 ) {
      while ( next<4 && !this.cells[x][next] ) {
        next++;
      }
      if (next>=4) { next--; }
      var currentCell = this.cells[x][current];
      var currentValue = currentCell ? Math.log(currentCell.value) : 0;
      var nextCell = this.cells[x][next];
      var nextValue = nextCell ? Math.log(nextCell.value) : 0;
      if (currentValue > nextValue) {
        totals[0] += nextValue - currentValue;
      } else if (nextValue > currentValue) {
        totals[1] += currentValue - nextValue;
      }
      current = next;
      next++;
    }
  }

  // left/right direction
  for (var y=0; y<4; y++) {
    var current = 0;
    var next = current+1;
    while ( next<4 ) {
      while ( next<4 && !this.cells[next][y] ) {
        next++;
      }
      if (next>=4) { next--; }
      var currentCell = this.cells[current][y];
      var currentValue = currentCell ? Math.log(currentCell.value) : 0;
      var nextCell = this.cells[next][y];
      var nextValue = nextCell ? Math.log(nextCell.value) : 0;
      if (currentValue > nextValue) {
        totals[2] += nextValue - currentValue;
      } else if (nextValue > currentValue) {
        totals[3] += currentValue - nextValue;
      }
      current = next;
      next++;
    }
  }

  return (Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3])) / Math.log(2);
}

Grid.prototype.maxValue = function() {
  var max = 0;
  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      if (this.cellOccupied(this.indexes[x][y])) {
        var value = this.cellContent(this.indexes[x][y]).value;
        if (value > max) {
          max = value;
        }
      }
    }
  }

  return Math.log(max) / Math.log(2);
}

// WIP. trying to favor top-heavy distributions (force consolidation of higher value tiles)
/*
Grid.prototype.valueSum = function() {
  var valueCount = [];
  for (var i=0; i<11; i++) {
    valueCount.push(0);
  }

  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      if (this.cellOccupied(this.indexes[x][y])) {
        valueCount[Math.log(this.cellContent(this.indexes[x][y]).value) / Math.log(2)]++;
      }
    }
  }

  var sum = 0;
  for (var i=1; i<11; i++) {
    sum += valueCount[i] * Math.pow(2, i) + i;
  }

  return sum;
}
*/

// check for win
Grid.prototype.isWin = function() {
  var self = this;
  for (var x=0; x<4; x++) {
    for (var y=0; y<4; y++) {
      if (self.cellOccupied(this.indexes[x][y])) {
        if (self.cellContent(this.indexes[x][y]).value == 2048) {
          return true;
        }
      }
    }
  }
  return false;
}

//Grid.prototype.zobristTable = {}
//for
//Grid.prototype.hash = function() {
//}
