var container, stats;
var camera, scene, renderer;
var vrEffect;
var vrControls;
var mouseControls;
var headControls;
var controller;
var theta = Math.PI;
var pinchStrength;
var handPosition = [];
var mouse = new THREE.Vector2();
var cubes;
var controls = [];
var selected = null;
var lastSelected = null;
var timer;
var prevPointable = null;

init();
animate();

var highlightObject = function(object) {
  object.material.color.setHex(0xff0000);
};

var unHighlightObject = function(object) {
  var grayness = object.grayness
  object.material.color.setRGB(grayness,grayness,grayness);
};

var setPrevPointable = function(frame){
  var f = frame.pointables[0];
  if (typeof f == "undefined") {
    prevPointable = null;
  }
  else {
    prevPointable = f.tipPosition;
  } 
}

// leap motion controller
function initLeapMotion() { 
  window.controller = controller = new Leap.Controller({
    background: true
  });

  controller.use('transform', {
    vr: true,
    effectiveParent: camera
  });

  controller.use('boneHand', {
    scene: scene,
    arm: true
  });

  controller.on('frame', function(frame){
    if (prevPointable == null) {
      setPrevPointable(frame);
    }
    var selects = selector(frame, cubes);
    if (selects.length == 0) {
      if (selected != null) {
        unHighlightObject(selected);
        lastSelected = selected;
        selected = null;

        console.log('initial start timer');
        timer = new Stopwatch();
        timer.start();
      }
    }
    else {
      var obj = selects[0].object;
      if (selected != null && selected.id != obj.id) {
        unHighlightObject(selected);
      }
      // if multiple selected, this will have to be a loop
      selected = obj;
      highlightObject(selected);
    }

    if (lastSelected != null) {
      if (timer.lap() <= 250) {
        selected = lastSelected; 
        highlightObject(selected);
        if (translation(frame, selected, prevPointable) || 
            rotation(frame, selected)) {
          timer = new Stopwatch();
          timer.start();
        }
        else {
          unHighlightObject(selected);
          selected = null;
        }
      }
      else {
        unHighlightObject(lastSelected);
        lastSelected = null;
        timer.end();
      }
    }

    setPrevPointable(frame);
  });

  var getPinchStrength = function(hand){
    pinchStrength = hand.pinchStrength;
  }

  controller.on('hand', getPinchStrength);

  controller.connect();
}

function init() {
  container = document.createElement( 'div' )
  document.body.appendChild( container );

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 );
  camera.position.x = 0;
  camera.position.y = 0;
  camera.position.z = 100;
  camera.lookAt( scene.position );

  // world coordinate system (thin dashed helping lines)
  var origin = new THREE.Vector3(0, 0, 0);
  var lineGeometry = new THREE.Geometry();
  var vertArray = lineGeometry.vertices;
  vertArray.push(new THREE.Vector3(1000, 0, 0), origin, new THREE.Vector3(0, 1000, 0), origin, new THREE.Vector3(0, 0, 1000));
  lineGeometry.computeLineDistances();
  var lineMaterial = new THREE.LineDashedMaterial({color: 0xcccccc, dashSize: 1, gapSize: 2});
  var coords = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(coords);

  var light = new THREE.DirectionalLight( 0xffffff, 1 );
  light.position.set( 1, 1, 1 ).normalize();
  scene.add( light );

  var geom = new THREE.BoxGeometry( 50, 50, 50 );

  cubes = new THREE.Object3D();

  for(var i = 0; i < 1; i++ ) {
    var grayness = Math.random() * 0.5 + 0.25;
    var mat = new THREE.MeshLambertMaterial( { color: 0xffffff, morphTargets: true } );
    mat.color.setRGB( grayness, grayness, grayness );
    
    for ( var i = 0; i < geom.vertices.length; i ++ ) {

      var vertices = [];

      for ( var v = 0; v < geom.vertices.length; v ++ ) {

        vertices.push( geom.vertices[ v ].clone() );

        if ( v === i ) {

          vertices[ vertices.length - 1 ].x *= 2;
          vertices[ vertices.length - 1 ].y *= 2;
          vertices[ vertices.length - 1 ].z *= 2;

        }

      }

      geom.morphTargets.push( { name: "target" + i, vertices: vertices } );

    }
    var cube = new THREE.Mesh( geom, mat );

    cube.position.x = -25;
    cube.position.y = -25;
    cube.position.z = -25;

    cube.scale.x = 1;
    cube.scale.y = 1;
    cube.scale.z = 1;

    cube.grayness = grayness; // *** NOTE THIS
    cubes.add(cube);

    // leap object controls
    var control = new THREE.LeapObjectControls(camera, cube)

    control.rotateEnabled  = true;
    control.rotateSpeed    = 3;
    control.rotateHands    = 1;
    control.rotateFingers  = [2, 3];

    control.scaleEnabled   = true;
    control.scaleSpeed     = 3;
    control.scaleHands     = 1;
    control.scaleFingers   = [4, 5];

    control.panEnabled     = true;
    control.panSpeed       = 3;
    control.panHands       = 2;
    control.panFingers     = [6, 12];
    control.panRightHanded = false; // for left-handed person

    controls[cube.id] = control;
  }

  scene.add(cubes)

  initLeapMotion();

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );

  var fullScreenButton = document.querySelector( '.full-screen' );
  var mouseLookButton = document.querySelector( '.mouse-look' );
  var mouseLook = false;

  fullScreenButton.onclick = function() {
    vrEffect.setFullScreen( true );
  };

  vrControls = new THREE.VRControls(camera);
  mouseControls = new THREE.MouseControls(camera);
  headControls = vrControls;

  mouseLookButton.onclick = function() {
    mouseLook = !mouseLook;

    if (mouseLook) {
      headControls = mouseControls;
      mouseLookButton.classList.add('enabled');
    } else {
      headControls = vrControls;
      mouseLookButton.classList.remove('enabled');
    }
  }

  vrEffect = new THREE.VREffect(renderer, VREffectLoaded);
  function VREffectLoaded(error) {
    if (error) {
      fullScreenButton.innerHTML = error;
      fullScreenButton.classList.add('error');
    }
  }

  renderer.setClearColor( 0xf0f0f0 );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.sortObjects = false;
  container.appendChild( renderer.domElement );

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  container.appendChild( stats.domElement );

  document.addEventListener( 'mousemove', onDocumentMouseMove, false );

  //

  window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  vrEffect.setSize( window.innerWidth, window.innerHeight );

}

function onDocumentMouseMove( event ) {

  event.preventDefault();

  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

}

//

function animate() {

  requestAnimationFrame( animate );

  render();
  stats.update();

}

function render() {
  camera.updateMatrixWorld();
  
  headControls.update();
  vrEffect.render( scene, camera );
}

Stopwatch = function() {
  this.startMilliseconds = 0;
  this.elapsedMilliseconds = 0;
}

Stopwatch.prototype.start = function() {
  this.startMilliseconds = new Date().getTime();
}

Stopwatch.prototype.lap = function() {
  return new Date().getTime() - this.startMilliseconds;
}

Stopwatch.prototype.end = function() {
  this.elapsedMilliseconds = new Date().getTime() - this.startMilliseconds;
  this.startMilliseconds = 0;
}
