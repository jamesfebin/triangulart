'use strict';

import storage from './storage.js'
import BackStack from './backStack.js'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Triangulr class
 * instructions will follow, in an other commit, it's late now
 *
 * @param  string          containerId      Container DOM id
 */
function Triangulr (containerId) {
  this.container = document.getElementById(containerId);
  if (!this.container) {
    throw new Error ('Triangulr container "' + containerId + '" does not exists.');
  }
}

Triangulr.prototype.DEFAULT_COLOR = '#000';
Triangulr.prototype.BLANK_COLOR = '#FFF';
Triangulr.prototype.AUTOSAVE_TIMER = 5000;

Triangulr.prototype.ACTION_FILL = 1
Triangulr.prototype.ACTION_ERASE = 2
Triangulr.prototype.ACTION_MOVE = 3
Triangulr.prototype.ACTION_SELECT = 4

/**
 * Triangulr class
 * instructions will follow, in an other commit, it's late now
 *
 * @param  int              width            Triangle height
 * @param  int              height          Triangle height
 * @param  int              triangleHeight  Triangle height
 */
Triangulr.prototype.setCanvas = function (width, height, triangleWidth, isLandscape) {
  // Save input
  this.isLandscape = isLandscape;
  this.mapWidth = width;
  this.mapHeight = height;

  this.triangleWidth = triangleWidth;
  this.triangleHeight = Math.sqrt(Math.pow(triangleWidth, 2) - Math.pow(triangleWidth / 2, 2));
  this.triangleHeight = Math.round(this.triangleHeight);

  this.blockWidth = (this.triangleWidth / 2)
  this.blockRatio = this.blockWidth / this.triangleHeight
  this.lineLength = this.mapWidth * 2 - 1

  this.lines = [];
  this.exportData = [];
  this.pickedColor = this.DEFAULT_COLOR;

  this.palette = [];
  this.backStack = new BackStack();

  this.lineMapping();
  this.createTriangles();
  this.generateDom();

  window.debugPlayground = this //# DEV : kill this
}

/**
 * lineMapping
 * generate this.lines from the contructor info
 *
 */
Triangulr.prototype.lineMapping = function () {

  var x, y, line;
  var parity = this.triangleWidth / 4;
  var gap = parity;

  if (this.isLandscape) {
    for(y = 0; y<=this.mapHeight; y++) {
      line = [];
      for(x = 0; x<=this.mapWidth; x++) {
        line.push({
          x: x * this.triangleWidth + parity + gap,
          y: y * this.triangleHeight
        });
      }
      this.lines.push(line);
      parity *= -1;
    }
  }
  else {
    for(y = 0; y<=this.mapWidth; y++) {
      line = [];
      for(x = 0; x<=this.mapHeight; x++) {
        line.push({
          x: y * this.triangleHeight,
          y: x * this.triangleWidth + parity + gap
        });
      }
      this.lines.push(line);
      parity *= -1;
    }
  }
};

/**
 * createTriangles
 * use points form this.lines to generate triangles
 * and put them into this.exportData
 *
 */
Triangulr.prototype.createTriangles = function () {

  var x, parity, lineA, lineB, aIndex, bIndex, points, poly, pointsList;
  var counter = 0;
  var lineParite = true;
  this.exportData = [];

  for(x = 0; x<this.lines.length -1; x++) {
    lineA = this.lines[x];
    lineB = this.lines[x+1];
    aIndex = 0;
    bIndex = 0;
    parity = lineParite;

    do {
      // Get the good points
      points = [lineA[aIndex], lineB[bIndex]];
      if (parity) {
        bIndex++;
        points.push(lineB[bIndex]);
      }
      else {
        aIndex++;
        points.push(lineA[aIndex]);
      }
      parity = !parity;

      // Save the triangle
      pointsList = [
        points[0],
        points[1],
        points[2]
      ];
      this.exportData.push({
        points: pointsList
      });
      counter++;
    } while (aIndex != lineA.length-1 && bIndex != lineA.length-1);

    lineParite = !lineParite;
  }
};

/**
 * generateDom
 * generate the SVG object from exportData content
 *
 * @return {[object]} Svg DOM object
 */
Triangulr.prototype.generateDom = function () {
  if (this.svgTag) {
    this.container.removeChild(this.svgTag);
    this.svgTag.remove();
  }

  let svgTag = this.generateSVG(),
      pos = null
  
  // var mouseListener = e => {
  //   moveListener(e.offsetX, e.offsetY)
  // }

  // var touchListener = e => {
  //   e.preventDefault();
  //   moveListener(e.touches[0].pageX - 16, e.touches[0].pageY - 16)
  // }


  var startActionListener = (e) => {
    if (this.action === this.ACTION_SELECT &&
        this.selection && this.selection.coordinates &&
        childOf(e.target, this.selection.domArea)) {
      this.selection.dragStart = this.coordinatorFromEvent(e)
    }
    else {
      moveListener(e)
    }
  }

  var moveListener = (e) => {
    let position = this.coordinatorFromEvent(e)
    if (!position || position.index === pos) {
      return
    }
    pos = position.index

    switch (this.action) {
    case this.ACTION_FILL:
      this.fillTriangle(pos, this.color)
      break
    
    case this.ACTION_ERASE:
    this.fillTriangle(pos, null)
      break
    
    case this.ACTION_MOVE:
      break

    case this.ACTION_SELECT:
      if (this.selection && this.selection.dragStart) {
        this.updateDrag(position)
      }
      else {
        this.updateSelection(position)
      }
      
      break
    }
  }

  var endActionListener = (e) => {
    if (this.action === this.ACTION_SELECT) {
      e.preventDefault();
      if (this.selection.coordinates) {
        this.endSelectionMove()
      }
      else {
        this.endSelection()
      }
    }
    this.backStack.endAction()
    this.saveTimeout()
  }


  svgTag.addEventListener('mousedown', (e) => {
    console.log('CLICK DE PUUUUUTE')
    this.backStack.startAction()
    startActionListener(e)

    let mouseUpListener = (e) => {
      svgTag.removeEventListener('mousemove', moveListener)
      window.removeEventListener('mouseup', mouseUpListener);
      endActionListener(e)
    }
    svgTag.addEventListener('mousemove', moveListener)
    window.addEventListener('mouseup', mouseUpListener);
  });

  



  svgTag.addEventListener('touchstart', (e) => {
    this.backStack.startAction()
    startActionListener(e)

    let touchEndListener = (e) => {
      svgTag.removeEventListener('touchmove', moveListener);
      window.removeEventListener('touchend', touchEndListener);
      endActionListener(e)
    }
    svgTag.addEventListener('touchmove', moveListener);
    window.addEventListener('touchend', touchEndListener);
  });


  

  this.svgTag = svgTag;
  this.container.appendChild(svgTag);
  return svgTag;
};

/**
 * Call the coordinator from an event
 * @param event e Mouse or touch event on the svgTag
 * @return object Triangle information
 */
Triangulr.prototype.coordinatorFromEvent = function (e) {
  if (~e.type.indexOf('mouse')) {
    return this.coordinator(e.offsetX, e.offsetY)
  }
  else {
    e.preventDefault();
    return this.coordinator(e.touches[0].pageX - 16, e.touches[0].pageY - 16)
  }
}

/**
 * Return the info about a triangle available
 * at a specific position.
 * 
 * If a triangle  coordinate are avalable, the method will
 * return a following object
 * {
 *   x: (int) column index,
 *   y: (int) line index,
 *   index: (int) triangle index
 * }
 * 
 * Or null if no triangle is at these coordinates
 * 
 * @param int x X position in pixels
 * @param int y Y position in pixels
 * @return object Triangle informations
 */
Triangulr.prototype.coordinator = function (x, y) {
    
    if (!this.isLandscape) {
      [x, y] = [y, x]
    }

    let line = Math.floor(y / this.triangleHeight),
        isEvenLine = line % 2 === 0,
        blockIndex = Math.floor(x / this.blockWidth),
        isEvenBlock = blockIndex % 2 === 0,
        blockX = x % this.blockWidth,
        blockY = y % this.triangleHeight


    if (isEvenBlock && isEvenLine || (!isEvenBlock && !isEvenLine)) {
      if ((blockX / (this.triangleHeight - blockY)) < this.blockRatio) {
        blockIndex--
      }
    }
    else {
      if ((blockX / blockY) < this.blockRatio) {
        blockIndex--
      }
    }

    if (blockIndex < 0 || blockIndex >= this.lineLength) {
      return null
    }
    else {
      return {
        x: blockIndex,
        y: line,
        index: this.lineLength * line + blockIndex
      }
    }
}

Triangulr.prototype.updateSelection = function (position) {
  if (this.selection && this.selection.coordinates) {
    this.clearSelection()
  }
  if (!this.selection) {
    this.selection = {
      start: position,
      domArea: document.createElementNS(SVG_NAMESPACE, 'rect')
    }
    this.selection.domArea.setAttribute('class', 'selector-rect')
    this.svgTag.appendChild(this.selection.domArea)
  }
  this.selection.end = position

  let start = this.selection.start,
      end = this.selection.end,
      rect = this.selection.domArea,
      minX = Math.min(start.x, end.x) * this.blockWidth,
      maxX = (Math.max(start.x, end.x) + 2) * this.blockWidth,
      minY = Math.min(start.y, end.y) * this.triangleHeight,
      maxY = (Math.max(start.y, end.y) + 1) * this.triangleHeight

  if (this.isLandscape) {
    rect.setAttribute('x', minX)
    rect.setAttribute('y', minY)
    rect.setAttribute('width', maxX - minX)
    rect.setAttribute('height', maxY - minY)
  }
  else {
    rect.setAttribute('x', minY)
    rect.setAttribute('y', minX)
    rect.setAttribute('width', maxY - minY)
    rect.setAttribute('height', maxX - minX)
  }
}

Triangulr.prototype.endSelection = function () {
  if (!this.selection) {
    return
  }

  let blank, 
      blankArea = document.createElementNS(SVG_NAMESPACE, 'g'),
      clones = document.createElementNS(SVG_NAMESPACE, 'g'),
      start = this.selection.start,
      end = this.selection.end,
      offsetX = Math.min(start.x, end.x),
      width = Math.max(start.x, end.x) - offsetX + 1,
      offsetY = Math.min(start.y, end.y),
      height = Math.max(start.y, end.y) - offsetY + 1

  this.selection.coordinates = {
    width,
    height,
    offsetX,
    offsetY,
    moveX: 0,
    moveY: 0
  }

  this.indexesFromCoordinates(offsetX, offsetY, width, height)
    .map(index => {
      blank = this.svgTag.childNodes[index].cloneNode()
      clones.appendChild(blank.cloneNode())
      blank.setAttribute('fill', this.BLANK_COLOR)
      blankArea.appendChild(blank)
    })

  clones.appendChild(this.selection.domArea)
  clones.setAttribute('class', 'movable')
  this.selection.domArea = clones
  this.selection.blankArea = blankArea
  this.svgTag.appendChild(blankArea)
  this.svgTag.appendChild(clones)
}

Triangulr.prototype.indexesFromCoordinates = function (x, y, width, height) {
  if (x < 0 || y < 0 || width < 0 || height < 0 || (x+width) > this.lineLength || (y+height) > this.mapHeight) {
    throw new Error ('Try to get indexes from invalid coordinates')
  }
  let output = []
  for (let yPos = 0; yPos < height; yPos++) {
    for (let xPos = 0; xPos < width; xPos++) {
      output.push((yPos + y) * this.lineLength + xPos + x)
    }
  }
  return output
}

Triangulr.prototype.endSelectionMove = function () {
  let coordinates = this.selection.coordinates
  console.warn(coordinates.moveX, coordinates.moveY)
  coordinates.moveX += coordinates.dragX
  coordinates.moveY += coordinates.dragY
  console.warn(coordinates.moveX, coordinates.moveY)
  
}

Triangulr.prototype.updateDrag = function (position) {
  let coor = this.selection.coordinates,
      dragX = Math.round((position.x - this.selection.dragStart.x)/2) * 2,
      dragY = Math.round((position.y - this.selection.dragStart.y)/2) * 2

  if (this.isLandscape) {
    let newX  = dragX + coor.offsetX + coor.moveX,
        newY  = dragY + coor.offsetY + coor.moveY

    if (newX >= 0 && (newX + coor.width) <= this.lineLength && newY >= 0 && (newY + coor.height) <= this.mapHeight) {
      coor.dragX = dragX
      coor.dragY = dragY
      this.selection.domArea.style.transform = `translate(${(coor.moveX+dragX)*this.blockWidth}px,${(coor.moveY+dragY)*this.triangleHeight}px)`
    }
  }
  else {
    [dragX, dragY] = [dragY, dragX]
    let newX  = dragY + coor.offsetX + coor.moveY,
        newY  = dragX + coor.offsetY + coor.moveX

    if (newX >= 0 && (newX + coor.width) <= this.lineLength && newY >= 0 && (newY + coor.height) <= this.mapHeight) {
      coor.dragX = dragX
      coor.dragY = dragY
      this.selection.domArea.style.transform = `translate(${(coor.moveX+dragX)*this.triangleHeight}px,${(coor.moveY+dragY)*this.blockWidth}px)`
    }
  }
  

}

Triangulr.prototype.clearSelection = function () {
  if (!this.selection) {
    return
  }
  this.applySelection()
  if (this.selection.blankArea) {
    this.svgTag.removeChild(this.selection.blankArea)
  }
  this.svgTag.removeChild(this.selection.domArea)
  this.selection = null
}


Triangulr.prototype.applySelection = function () {
  if (!this.selection || !this.selection.coordinates || (!this.selection.coordinates.moveX && !this.selection.coordinates.moveY)) {
    return
  }
  this.backStack.startAction()
  let c = this.selection.coordinates,
      colors = this.indexesFromCoordinates(
        c.offsetX,
        c.offsetY,
        c.width,
        c.height
      ).map(index => {
        let cc = this.exportData[index].color
        this.fillTriangle(index)
        return cc
      })


  this.indexesFromCoordinates(
    c.offsetX + (this.isLandscape ? c.moveX : c.moveY),
    c.offsetY + (this.isLandscape ? c.moveY : c.moveX),
    c.width,
    c.height
  )
  .forEach((pointIndex, index) => {
    this.fillTriangle(pointIndex, colors[index])
  })
  this.backStack.endAction()
}

Triangulr.prototype.fillTriangle = function (pos, color) {
  this.backStack.actionStack(pos, this.exportData[pos].color)
  this.exportData[pos].color = color
  this.svgTag.childNodes[pos].setAttribute('fill', color || this.BLANK_COLOR)
}

/**
 * Generate the SVG map from the information
 * of the instance. An optional boolean is available
 * to generate a clean SVG to produce a lightweight
 * SVG (used for export)
 * 
 * @param boolean isClean To produce a clean SVG
 * @return SVGDOMElement The artwork
 */
Triangulr.prototype.generateSVG = function (isClean) {
  var i, data, points, polygon;
  var svgTag = document.createElementNS(SVG_NAMESPACE, 'svg');

  svgTag.setAttribute('version', '1.1');
  svgTag.setAttribute('preserveAspectRatio', 'xMinYMin slice');

  if (this.isLandscape) {
    svgTag.setAttribute('width', this.mapWidth * this.triangleWidth);
    svgTag.setAttribute('height', this.mapHeight * this.triangleHeight);
    svgTag.setAttribute('viewBox', '0 0 ' + (this.mapWidth * this.triangleWidth) + ' ' + (this.mapHeight * this.triangleHeight));
  }
  else {
    svgTag.setAttribute('width', this.mapWidth * this.triangleHeight);
    svgTag.setAttribute('height', this.mapHeight * this.triangleWidth);
    svgTag.setAttribute('viewBox', '0 0 ' + (this.mapWidth * this.triangleHeight) + ' ' + (this.mapHeight * this.triangleWidth));
  }

  for(i in this.exportData) {
    data = this.exportData[i];
    if (isClean && !data.color) {
      continue;
    }
    polygon = document.createElementNS(SVG_NAMESPACE,'path');
    points   = 'M' + data.points[0].x + ' ' + data.points[0].y + ' ';
    points  += 'L' + data.points[1].x + ' ' + data.points[1].y + ' ';
    points  += 'L' + data.points[2].x + ' ' + data.points[2].y + ' Z';
    polygon.setAttribute('d', points);
    polygon.setAttribute('fill', data.color || this.BLANK_COLOR);
    polygon.setAttribute('rel', i);
    svgTag.appendChild(polygon);
  }
  return svgTag;
}

Triangulr.prototype.exportSVG = function () {
  return this.generateSVG(true).outerHTML;
};

Triangulr.prototype.export = function () {
  return {
    isLandscape: this.isLandscape,
    mapWidth: this.mapWidth,
    mapHeight: this.mapHeight,
    mapData: this.exportData.map(function (e) {return e.color || null}),
    triangleWidth: this.triangleWidth,
    palette: this.palette
  };
};

Triangulr.prototype.import = function (data) {
  this.setCanvas(
    data.mapWidth,
    data.mapHeight,
    data.triangleWidth,
    data.isLandscape
  );

  this.palette = data.palette || []
  this.backStack.reset()

  for (var i in data.mapData) {
    this.exportData[i].color = data.mapData[i];
  }

  for (var i = 0; i < this.svgTag.childNodes.length; i++) {
    this.svgTag.childNodes[i].setAttribute('fill', this.exportData[i].color || this.BLANK_COLOR);
  }
};




Triangulr.prototype.loadWorkspaceFromFile = function (data) {
  console.log('loadWorkspaceFromFile', data)
  this.import(data)
  this.workspace = storage.createItem('imported file')
  storage.updateItem(this.workspace.id, this.export())
  return true
}
Triangulr.prototype.loadWorkspaceFromStorage = function (id) {
  console.log('loadWorkspaceFromStorage', id)
  this.workspace = {id}
  this.import(storage.getItem(id))
  return true
}
Triangulr.prototype.newWorkspace = function (data) {
  console.log('newWorkspace', data)
  this.setCanvas(data.width, data.height, 30, data.isLandscape);
  this.workspace = storage.createItem(data.name || 'untitled')
  storage.updateItem(this.workspace.id, this.export())
  return true
}

Triangulr.prototype.save = function () {
  console.log('SAVIN')
  storage.updateItem(this.workspace.id, this.export())
}


Triangulr.prototype.saveTimeout = function  () {
  //# DO NOT FORGET TO CLEAR THIS WHEN LEAVING THE WORKSPACE
  if (this.saveTimer) {
    console.log('clear timer')
    clearTimeout(this.saveTimer)
  }
  console.log('timer set')
  this.saveTimer = setTimeout(() => this.save(), this.AUTOSAVE_TIMER)
}

/* Controls
 */

/**
 * togglePreview
 * toggle the class preview to the SVG
 * To show/hide the strokes
 *
 */
Triangulr.prototype.togglePreview = function () {
  if (!this.svgTag) {
    return
  }
  this.svgTag.classList.toggle('preview')
};


/**
 * Set a new mode to the editor between the following
 * actions:
 * 
 * ACTION_FILL
 * ACTION_ERASE
 * ACTION_MOVE
 * ACTION_SELECT
 * 
 * @param action  number Action index (from triangulr consts)
 */
Triangulr.prototype.setMode = function (action) {
  // No effects if the new action is the existing one
  if (this.action === action) {
    return
  }
  // Apply the selection if there's a seection
  if (this.action === this.ACTION_SELECT) {
    this.clearSelection()
  }
  this.action = action 
}

Triangulr.prototype.isOnMode = function (action) {
  return this.action === action
}

Triangulr.prototype.setColor = function (color) {
  this.color = color;
}


Triangulr.prototype.addColor = function (color) {
  if (!color || this.palette.indexOf(color) !== -1) {
    return;
  }
  this.palette.push(color);
};


Triangulr.prototype.undo = function () {
  let fill, backAction = this.backStack.popLastAction()
  for (let fillIndex in backAction) {
    fill = backAction[fillIndex]
    this.exportData[fill[0]].color = fill[1]
    this.svgTag.childNodes[fill[0]].setAttribute('fill', fill[1] || 'none')
  }
}

/**
 * Found at 
 * https://stackoverflow.com/questions/2234979/how-to-check-in-javascript-if-one-element-is-contained-within-another
 * +1 kudo for gitaarLab
 * @param {DOMElement} c Child node
 * @param {DOMElement} p Parent Node
 * @return boolean True if child of
 */
function childOf(c, p) {
  while((c=c.parentNode)&&c!==p); 
  return !!c; 
}

export default Triangulr
