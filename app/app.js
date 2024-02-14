//IMPORT MODULES
import '../style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise3D} from "simplex-noise";
import alea from 'alea';
import {TriangleTable } from '../ModifiedMarchingCubes.js';
import GUI from 'lil-gui';

//CONSTANT & VARIABLES
let width = window.innerWidth;
let height = window.innerHeight;

// UI Setup

const gui = new GUI();

const folderNoise = gui.addFolder( 'Noise Parameters' ); 
const folderMeshDisplay = gui.addFolder( 'Mesh Display' ); 
const folderGridSettings = gui.addFolder( 'Grid Size' ); 
const folderView = gui.addFolder( 'Camera Controls' ); 

const params = {
  X: 20,
  Y: 20,
  Z: 40,
  resolution: 0.15,
  threshold: -0.3,
  shiftnoiseX: 0,
  shiftnoiseY: 0,
  shiftnoiseZ: 0,
  //seed: "seed",
  //displayColor: 0xffffff,
	wireframe: true,
  autorotate: true,
  autorotateSpeed: 3
};

folderNoise.add( params, 'resolution', 0, 0.5, 0.01 ) .onChange( function () {recompute()} );
folderNoise.add( params, 'threshold', -1.5, 1.5, 0.01 )    .onChange( function () {recompute()} );
folderNoise.add( params, 'shiftnoiseX', -10, 10, 0.01)   .onChange( function () {recompute()} );
folderNoise.add( params, 'shiftnoiseY', -10, 10, 0.01)   .onChange( function () {recompute()} );
folderNoise.add( params, 'shiftnoiseZ', -10, 10, 0.01)   .onChange( function () {recompute()} );
//folderNoise.add( params, 'seed' )                     .onChange( function () {recompute()} );

//folderMeshDisplay.addColor( params, 'displayColor' )  .onChange( function () {recompute()} );
folderMeshDisplay.add( params, 'wireframe' )          .onChange( function () {recompute()} );

// Grid Parameters
folderGridSettings.add( params, 'X', 1, 100, 1 )      .onChange( function () {recompute()} );
folderGridSettings.add( params, 'Y', 1, 100, 1  )     .onChange( function () {recompute()} );
folderGridSettings.add( params, 'Z', 1, 100, 1  )     .onChange( function () {recompute()} );
folderView.add( params, 'autorotate' )        .onChange( function () {recompute()} );
folderView.add( params, 'autorotateSpeed', 0, 10, 1 )        .onChange( function () {recompute()} );

// Noise Variables
var prng = alea('seed');
var noise = createNoise3D(prng);

//-- SCENE VARIABLES
var scene;
var camera;
var renderer;
var container;
var control;
var ambientLight;
var directionalLight;
var helperGrid;
var mesh;
var grid;

function main(){
  //CREATE SCENE AND CAMERA
  scene = new THREE.Scene();
  //scene.fog = new THREE.Fog( 0xffffff, 0, 1000 );
  camera = new THREE.PerspectiveCamera( 15, width / height, 0.1, 1000);
  camera.position.set(  180, 100, 180)

  // grid and mesh
  grid = new Grid(params.X,params.Y,params.Z, params.threshold);
  grid.displayMesh(scene);

  // Grid Helper
  helperGrid = new THREE.GridHelper( params.X+5 , params.X+5)
  helperGrid.position.x = params.X/2;
  helperGrid.position.z = params.Y/2;
  helperGrid.material.opacity = 0.25;
  helperGrid.material.transparent = true;
  scene.add(helperGrid);
  //const grid = new THREE.InfiniteGridHelper(10, 100);
  //scene.add(grid);

  //LIGHTINGS
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight( 0xffffff, 1);
  directionalLight.position.set(2,5,5);
  directionalLight.target.position.set(10,10,10);
  scene.add( directionalLight );
  scene.add(directionalLight.target);

  //RESPONSIVE WINDOW
  window.addEventListener('resize', handleResize);
 
  //CREATE A RENDERER
  renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container = document.querySelector('#threejs-container');
  container.append(renderer.domElement);

  //CREATE MOUSE CONTROL
  control = new OrbitControls( camera, renderer.domElement );
  control.target = new THREE.Vector3(params.X/2, params.Z/2, params.Y/2)
  control.autoRotate = params.autorotate;
  control.autoRotateSpeed = 2;


  //EXECUTE THE UPDATE
  animate();
  console.log(camera.position)
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  control.update();
  renderer.render(scene, camera);
}



function recompute(){
  if ( grid == undefined ) {
    grid = null;
  }
  if ( mesh == undefined ) {
    //console.log("remove mesh")
    removeAllEntities() 
  }

  prng = alea('seed');
  noise = createNoise3D(prng);
  var grid = new Grid(params.X,params.Y,params.Z, params.threshold);
  grid.displayMesh(scene);

  control.autoRotate = params.autorotate;
  control.autoRotateSpeed = params.autorotateSpeed;
}

//RESPONSIVE
function handleResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.render(scene, camera);
}

//Remove 3D Objects and clean the caches
function removeAllEntities() {
    const objectsToRemove = [...scene.children];
    objectsToRemove.forEach(object => {
        if (object.isMesh) { 
            scene.remove(object);
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
    });
}

//-----------------------------------------------------------------------------------
// CLASSES 
//-----------------------------------------------------------------------------------

// Grid class defines size of Space and holds Cells with 8 corner Points, which hold charges that define if inside of Srf or not (dependend on threshold)
class Grid {
  constructor(width, depth, height, threshold) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.threshold = threshold
    this.cells = this.initializeGrid(threshold);
  }

  initializeGrid() { // For X,Y,Z direction clarification https://alexjmackey.files.wordpress.com/2013/09/coordinates.png
    let grid = new Array(this.width);
    for (let x = 0; x < this.width; x++) {
      grid[x] = new Array(this.height);
      for (let y = 0; y < this.height; y++) {
        grid[x][y] = new Array(this.depth);
        for (let z = 0; z < this.depth; z++) {
          grid[x][y][z] = new GridCell(x,y,z,this.threshold);
        }
      }
    }
    return grid;
  }

    // displays all GridCells as Center Points (Change to boxes as needed?)
    displayAllGridcells(scene, pointSize = 0.5, pointColor = 0xffffff) {
      let geometry = new THREE.BufferGeometry();
      let positions = [];
      
      // TO_DO: change to loop through nested arrays
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          for (let z = 0; z < this.depth; z++) {
            positions.push(x, y, z);
          }
        }
      }
  
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      let material = new THREE.PointsMaterial({ size: pointSize, color: pointColor });
      let points = new THREE.Points(geometry, material);
  
      // Add the points to the scene
      scene.add(points);
    }

    displayAllCornerPoints(scene, pointSize = 0.3, defaultColor = 0xff0000, specialColor = 0x00ff00) {
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          for (let z = 0; z < this.depth; z++) {
            var ind = 0;
            for (let point of this.cells[x][y][z].cornerPoints) {
              let geometry = new THREE.BufferGeometry();
              geometry.setFromPoints([point]);
              
              let material = new THREE.PointsMaterial({ size: 0.8, color: defaultColor });
              if (this.cells[x][y][z].cornerCharges[ind] > 0.2){
                material = new THREE.PointsMaterial({ size: 3, color: specialColor })
              }

              let points = new THREE.Points(geometry, material);
              scene.add(points);
              ind ++;
            }
          }
        }
      }
    }

    displayMesh(scene){
      var vertices = [];
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          for (let z = 0; z < this.depth; z++) {
            var verticesIndices = TriangleTable[this.cells[x][y][z].edgeTableIndex]
            for(let item of verticesIndices){
              if(item == -1)
                continue;
              vertices.push(this.cells[x][y][z].edgePoints[item])
            }
          }
        }
      }
      const meshGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const material = new THREE.MeshBasicMaterial({ color: 0x2e2e30, wireframe: params.wireframe });
      const mesh = new THREE.Mesh(meshGeometry, material);
      scene.add(mesh);
    }
}

class GridCell {
  constructor(x, y, z, threshold) {
    // Initialize all 8 corners of the cube as 0 (inactive)
    this.X = x;
    this.Y = y;
    this.Z = z;
    this.threshold = threshold;
    this.position = [x, y, z];
    this.cornerPoints = this.generateCornerPoints();
    this.edgePoints = this.generateEdgePoints();
    this.cornerCharges = this.generateCharges();
    this.cornersBinaryCode = this.generateChargesBinary(); // order depends on lookup table BEWARE!!! binary reads right to left but array fills left to right
    this.edgeTableIndex = this.generateTableIndex();
  }

  // Generate charges based on noisevalues
  generateCharges(){
    var charges = []
    for (let i = 0; i < this.cornerPoints.length; i++) {
      var point = this.cornerPoints[i];
      charges.push(noise(point.x*params.resolution+params.shiftnoiseX, point.y*params.resolution+params.shiftnoiseZ, point.z*params.resolution+params.shiftnoiseY))
    };

    return charges
  }

  // Generates the binary for edgesTable look up from right to left!
  generateChargesBinary(){
    var chargesBinary = [];
    for (let i = 0; i < this.cornerPoints.length; i++) {
      if (this.cornerCharges[i] <= this.threshold) {
        chargesBinary.push(0);
        
        continue;
      }
      chargesBinary.push(1);
    }
    return chargesBinary;
  }

  // Converts the binary to a index value for lookup table (e.g. 0000 0000 -> 0 / 0100 0010 -> 66)
  generateTableIndex(){
  var tableIndex = 0;
    if (this.cornersBinaryCode[0] == 1) tableIndex += 1;
    if (this.cornersBinaryCode[1] == 1) tableIndex += 2;
    if (this.cornersBinaryCode[2] == 1) tableIndex += 4;
    if (this.cornersBinaryCode[3] == 1) tableIndex += 8;
    if (this.cornersBinaryCode[4] == 1) tableIndex += 16;
    if (this.cornersBinaryCode[5] == 1) tableIndex += 32;
    if (this.cornersBinaryCode[6] == 1) tableIndex += 64;
    if (this.cornersBinaryCode[7] == 1) tableIndex += 128;
   return tableIndex;
  }

  // Sets all 8 Corner points in order like in "ModifiedMarchingCubes.js"
  // Vertex and edge layout:
  //
  //            6             7
  //            +-------------+               +-----6-------+   
  //          / |           / |             / |            /|   
  //        /   |         /   |          11   7         10   5
  //    2 +-----+-------+  3  |         +-----+2------+     |   
  //      |   4 +-------+-----+ 5       |     +-----4-+-----+   
  //      |   /         |   /           3   8         1   9
  //      | /           | /             | /           | /       
  //    0 +-------------+ 1             +------0------+         
  //
  generateCornerPoints() {
    var cornerPoints = [];
    // close face https://alexjmackey.files.wordpress.com/2013/09/coordinates.png
    cornerPoints.push(new THREE.Vector3(this.X - 0.5, this.Y - 0.5, this.Z + 0.5));
    cornerPoints.push(new THREE.Vector3(this.X + 0.5, this.Y - 0.5, this.Z + 0.5));
    cornerPoints.push(new THREE.Vector3(this.X - 0.5, this.Y + 0.5, this.Z + 0.5));
    cornerPoints.push(new THREE.Vector3(this.X + 0.5, this.Y + 0.5, this.Z + 0.5));

    // far face: https://alexjmackey.files.wordpress.com/2013/09/coordinates.png
    cornerPoints.push(new THREE.Vector3(this.X - 0.5, this.Y - 0.5, this.Z - 0.5));
    cornerPoints.push(new THREE.Vector3(this.X + 0.5, this.Y - 0.5, this.Z - 0.5));
    cornerPoints.push(new THREE.Vector3(this.X - 0.5, this.Y + 0.5, this.Z - 0.5));
    cornerPoints.push(new THREE.Vector3(this.X + 0.5, this.Y + 0.5, this.Z - 0.5));
    return cornerPoints;
  }

  generateEdgePoints(){
    var edgePoints = [];
    edgePoints.push(new THREE.Vector3(this.X + 0  , this.Y - 0.5, this.Z + 0.5));
    edgePoints.push(new THREE.Vector3(this.X + 0.5, this.Y + 0  , this.Z + 0.5));
    edgePoints.push(new THREE.Vector3(this.X + 0  , this.Y + 0.5, this.Z + 0.5));
    edgePoints.push(new THREE.Vector3(this.X - 0.5, this.Y + 0  , this.Z + 0.5));

    edgePoints.push(new THREE.Vector3(this.X + 0  , this.Y - 0.5, this.Z - 0.5));
    edgePoints.push(new THREE.Vector3(this.X + 0.5, this.Y + 0  , this.Z - 0.5));
    edgePoints.push(new THREE.Vector3(this.X + 0  , this.Y + 0.5, this.Z - 0.5));
    edgePoints.push(new THREE.Vector3(this.X - 0.5, this.Y + 0  , this.Z - 0.5));

    edgePoints.push(new THREE.Vector3(this.X - 0.5, this.Y - 0.5, this.Z      ));
    edgePoints.push(new THREE.Vector3(this.X + 0.5, this.Y - 0.5, this.Z      ));
    edgePoints.push(new THREE.Vector3(this.X + 0.5, this.Y + 0.5, this.Z      ));
    edgePoints.push(new THREE.Vector3(this.X - 0.5, this.Y + 0.5, this.Z      ));

    return edgePoints;
  }
  
}

//-----------------------------------------------------------------------------------
// EXECUTE MAIN 
//-----------------------------------------------------------------------------------

main();