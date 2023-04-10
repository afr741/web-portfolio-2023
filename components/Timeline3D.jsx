import React, { Component } from 'react';
import { connect } from 'react-redux';
import { setCurrentTimelinePossition, getCurrentTimelinePossition } from '@/redux/missions';
import * as THREE from 'three';
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import styled from 'styled-components';
import CameraControls from 'camera-controls';
import initializeDomEvents from 'threex-domevents';
import { vw } from '@/styles/utils';

import Dot from './objects/Dot';
import Line from './objects/Line';

const HEIGHT = 800;
const WIDTH = 800;

const FAR = 50;

const DISTANCE = 40;
const TO_SIDE = 1.5;

const CAMERA_X = -0.8;
const CAMERA_Y = 2.5;
const CAMERA_Z = 27;

const CAMERA_LOOK_AT_X = -1.2;
const CAMERA_LOOK_AT_Y = -5;
const CAMERA_LOOK_AT_Z = 45;

const INDEX_STEP = 0.1;

let THREEx = {};

CameraControls.install({ THREE: THREE });
initializeDomEvents(THREE, THREEx);

class Timeline3D extends Component {
  constructor(props) {
    super(props);
    this.$canvas = React.createRef();
    this.clock = new THREE.Clock();
    this.renderer = null;
    this.camera = null;
    this.cameraControls = null;

    this.model = null;
    this.scene = null;
    this.tempV = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    //hotfix for load on server, resolve in proper way
    this.intervalRef = React.createRef();
  }

  componentDidMount() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.$canvas.current,
      alpha: true,
      antialias: true,
    });

    this.scene = new THREE.Scene();

    this.initCamera();

    this.domEvents = new THREEx.DomEvents(
      this.camera,
      this.renderer.domElement
    );

    this.initModel();
    this.resize();
    this.renderer.render(this.scene, this.camera);
    this.animateCameraMovement();
    //TODO test purposes, remove before final commit
    // this.animateCamera();
    //hotfix for load on server, resolve in proper way
    this.intervalRef.current = setInterval(() => this.renderer.render(this.scene, this.camera), 1000);
  }

  componentWillUnmount() {
    this.scene.traverse(o => {
      if (o.geometry) {
        o.geometry.dispose()
        //console.log("dispose geometry ", o.geometry)
      }

      if (o.material) {
        if (o.material.length) {
            for (let i = 0; i < o.material.length; ++i) {
              o.material[i].dispose()
              //console.log("dispose material ", o.material[i])
            }
        }
        else {
          o.material.dispose()
          //console.log("dispose material ", o.material)
        }
      }
    })

    this.scene = null;
    this.camera = null;
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.$canvas.current = null;
    //console.log('dispose')
  }

  initCamera = () => {
    const fov = 75;
    const aspect = WIDTH / HEIGHT;
    const near = 0.1;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, FAR);
    this.camera.position.set(CAMERA_X, CAMERA_Y, CAMERA_Z);
    this.camera.lookAt(CAMERA_LOOK_AT_X, CAMERA_LOOK_AT_Y, CAMERA_LOOK_AT_Z);

    //TODO test purposes, remove before final commit
    // this.cameraControls = new CameraControls(
    //   this.camera,
    //   this.renderer.domElement
    // );

    this.scene.add(this.camera);
  };

  initModel = () => {
    this.initDots();
    this.initLines();
  };

  initDots = () => {
    const { numberOfEvents } = this.props;

    for(let i = 0; i < numberOfEvents; i++) {
      const dot = new Dot();
      const x = i % 2 ? TO_SIDE : -TO_SIDE;
      const z = (i + 1) * DISTANCE
      dot.position.set(x, 0, z);
      this.scene.add( dot );
    }
  }

  initLines = () => {
    const { numberOfEvents } = this.props;

    const start = new THREE.Vector3(-TO_SIDE, 0, 0);
    const end = new THREE.Vector3(TO_SIDE, 0, DISTANCE);
    const dotsDistance = start.distanceTo(end);
    const rotation = Math.asin(DISTANCE/dotsDistance);

    for(let i = 0; i < numberOfEvents; i++) {
      const z = (i + 1) * DISTANCE + DISTANCE * 0.5;
      if(i < numberOfEvents - 1) {
        if(i % 2) {
          const lineClone = new Line('right', dotsDistance, rotation);
          lineClone.position.set(0, 0 , z);
          this.scene.add(lineClone);
        } else {
          const lineClone = new Line('left', dotsDistance, rotation);
          lineClone.position.set(0, 0 , z);
          this.scene.add(lineClone);
        }
      }
    }
  }

  resize = () => {
    let width = this.renderer.domElement.clientWidth;
    let height = this.renderer.domElement.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  animateCameraMovement = () => {
    const { timelinePosittion, setTimelinePossition } = this.props;
    const { index = 0 } =this.props;
    const positionRounded = +(timelinePosittion.toFixed(2));
    if(index !== positionRounded) {
      let nextPosition = positionRounded;
      if(positionRounded < index) {
        nextPosition = positionRounded + INDEX_STEP
      } else if(positionRounded > index) {
        nextPosition = positionRounded - INDEX_STEP
      }
      const reminder = nextPosition % 2;

      const x = reminder < 1 ? (CAMERA_X + (2 * -CAMERA_X * reminder)) : (-CAMERA_X - (2 * -CAMERA_X * (reminder - 1)));
      const atX = reminder < 1 ? (CAMERA_LOOK_AT_X + (2 * -CAMERA_LOOK_AT_X * reminder)) : (-CAMERA_LOOK_AT_X - (2 * -CAMERA_LOOK_AT_X * (reminder - 1)));

      this.camera.position.set(x, CAMERA_Y, CAMERA_Z + (nextPosition * DISTANCE));
      this.camera.lookAt(atX, CAMERA_LOOK_AT_Y, CAMERA_LOOK_AT_Z + (nextPosition * DISTANCE));
      setTimelinePossition(nextPosition);



      //TODO bloom pass for glow effect is not supporting transparency, resolve this later.
			// var params = {
			// 	exposure: 1,
			// 	bloomStrength: 1.5,
			// 	bloomThreshold: 0,
			// 	bloomRadius: 0
			// };

      // var renderPass = new RenderPass( this.scene, this.camera );
      // renderPass.clear=false;
      // renderPass.clearAlpha=false;
      // renderPass.clearColor=false;

      // var bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
      // bloomPass.clear = false;
			// bloomPass.threshold = params.bloomThreshold;
			// bloomPass.strength = params.bloomStrength;
      // bloomPass.radius = params.bloomRadius;

      // var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
      // var renderTarget = new THREE.WebGLRenderTarget( WIDTH, HEIGHT, parameters );
      // let composer = new EffectComposer( this.renderer, renderTarget );

			// composer.addPass( renderPass );
			// composer.addPass( bloomPass );

      // composer.render();

      this.renderer.render(this.scene, this.camera);
    }


    setTimeout(() => requestAnimationFrame(this.animateCameraMovement), 10);
  }

  //TODO test purposes, remove before final commit
  // animateCamera = () => {
  //   const delta = this.clock.getDelta();
  //   const hasControlsUpdated = this.cameraControls.update(delta);
  //   if (hasControlsUpdated) {
  //     this.renderer.render(this.scene, this.camera);
  //   }
  //   setTimeout(() => requestAnimationFrame(this.animateCamera), 10);
  // }

  render() {
    return (
      <Root>
        <Canvas ref={this.$canvas} onMouseMove={this.handleMouseMove} />
      </Root>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  timelinePosittion: getCurrentTimelinePossition(state)
});

const mapDispatchToProps = dispatch => {
  return {
    setTimelinePossition: (currentPosition) => dispatch(setCurrentTimelinePossition(currentPosition)),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Timeline3D)

const Root = styled.div`
  position: absolute;
  left: ${vw(390)};
  top: ${vw(280)};
  width: ${vw(WIDTH)};
  height: ${vw(HEIGHT)};
`;

const Canvas = styled.canvas`
  height: 100%;
  width: 100%;
`;
