// Game entry: scene setup, input, main loop, screenshot staging.
import * as THREE from 'three';
import { clamp } from './config.js';
import { buildTerrain, buildWater, buildSky, terrainHeight } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { FlightModel } from './flight-model.js';
import { CameraRig } from './camera-rig.js';
import { buildRunway, buildRings, buildProps, RING_PATH } from './world-props.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { applyShotPose } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8e9694, 24, 420);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 16000);
scene.add(camera);

scene.add(new THREE.AmbientLight(0x7d8684, 0.38));
scene.add(new THREE.HemisphereLight(0xc5d0d2, 0x3d4632, 0.85));
const sun = new THREE.DirectionalLight(0xfff3e0, 1.25);
sun.position.set(-320, 680, -180);
scene.add(sun);

scene.add(buildSky());
scene.add(buildTerrain());
const water = buildWater();
scene.add(water);
const runway = buildRunway();
scene.add(runway.group);
const ringSet = buildRings();
scene.add(ringSet.group);
ringSet.rings.forEach((ring, i) => {
  const prev = i === 0 ? { x: 520, y: 12, z: 800 } : RING_PATH[i - 1];
  ring.lookAt(prev.x, prev.y, prev.z);
});
scene.add(buildProps());

const operator = buildAircraft();
scene.add(operator.group);
scene.add(operator.blob);
camera.add(operator.viewmodel);

const flight = new FlightModel();
const cameraRig = new CameraRig(camera);
const missions = new Missions(scene);
const combat = new Combat(scene);
const audio = new GameAudio();
const hud = new Hud();

const params = new URLSearchParams(window.location.search);
const shotMode = applyShotPose(params.get('shot'), flight, cameraRig, missions, combat);

const keys = new Set();
const edges = { crouch: false, prone: false, jump: false, reload: false, grenade: false, smoke: false };
let weaponEdge = null;
let fireHeld = false;
let firePressed = false;
let adsHeld = false;
const look = { yaw: 0, pitch: 0 };

function restart() {
  flight.reset();
  missions.reset();
  combat.reset();
  ringSet.rings.forEach((ring) => ring.material.color.set(0xd7a441));
  cameraRig.mode = 'fps';
  cameraRig.ready = false;
  cameraRig.fov = 70;
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  audio.start();
  if (e.code === 'KeyV') cameraRig.toggle();
  if (e.code === 'KeyT') combat.auto = !combat.auto;
  if (e.code === 'KeyC') edges.crouch = true;
  if (e.code === 'KeyZ') edges.prone = true;
  if (e.code === 'KeyR') {
    if (flight.crashed || missions.done) restart();
    else edges.reload = true;
  }
  if (e.code === 'Enter') restart();
  if (e.code === 'KeyG') edges.grenade = true;
  if (e.code === 'KeyX') edges.smoke = true;
  if (e.code === 'Digit1') weaponEdge = 0;
  if (e.code === 'Digit2') weaponEdge = 1;
  if (e.code === 'Space') { edges.jump = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('click', () => {
  audio.start();
  if (!shotMode && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
window.addEventListener('mousedown', (e) => {
  audio.start();
  if (e.button === 0) { fireHeld = true; firePressed = true; }
  if (e.button === 2) adsHeld = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) fireHeld = false;
  if (e.button === 2) adsHeld = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => { fireHeld = false; adsHeld = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = (combat.ads ? 0.00115 : 0.0019) * (keys.has('KeyF') && combat.ads ? 0.7 : 1);
  look.yaw += e.movementX * sens;
  look.pitch += -e.movementY * sens;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('error', (ev) => { window.__lenteraError = String(ev.message); });

function readInput() {
  const input = {
    forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    crouchHeld: keys.has('ControlLeft') || keys.has('ControlRight'),
    crouchToggle: edges.crouch,
    proneToggle: edges.prone,
    jump: edges.jump,
    yaw: look.yaw,
    pitch: look.pitch,
    lean: (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0),
    ads: adsHeld,
  };
  edges.crouch = false;
  edges.prone = false;
  edges.jump = false;
  look.yaw = 0;
  look.pitch = 0;
  return input;
}

function combatActions() {
  const actions = {
    fireHeld,
    firePressed,
    ads: adsHeld,
    reload: edges.reload,
    grenade: edges.grenade,
    smoke: edges.smoke,
    weapon: weaponEdge,
    steady: keys.has('KeyF'),
  };
  edges.reload = false;
  edges.grenade = false;
  edges.smoke = false;
  weaponEdge = null;
  firePressed = false;
  return actions;
}

function poseViewmodel() {
  const ads = combat.ads && cameraRig.mode === 'fps';
  const moving = clamp(flight.speed / 6, 0, 1);
  const bob = Math.sin(flight.bob * 2) * (ads ? 0.004 : 0.014) * moving;
  const sway = Math.cos(flight.bob) * (ads ? 0.003 : 0.012) * moving;
  const reloadDip = combat.reloadTimer > 0 ? 0.08 : 0;
  const sprintDip = flight.sprinting ? 0.04 : 0;
  operator.viewmodel.position.set(
    (ads ? 0.02 : 0.22) + sway,
    (ads ? -0.2 : -0.26) + bob - reloadDip - sprintDip,
    ads ? -0.4 : -0.52,
  );
  operator.viewmodel.rotation.set(
    flight.recoilPitch * 1.6 + (combat.reloadTimer > 0 ? 0.4 : 0),
    flight.recoilYaw * 0.9,
    -flight.lean * 0.05,
  );
  const carbineOn = combat.weapon().id === 'carbine';
  operator.carbine.visible = carbineOn;
  operator.pistol.visible = !carbineOn;
  operator.carbine.userData.muzzle.visible = carbineOn && combat.muzzleTimer > 0;
  operator.pistol.userData.muzzle.visible = !carbineOn && combat.muzzleTimer > 0;
  operator.viewmodel.visible = cameraRig.mode === 'fps';
  operator.group.visible = cameraRig.mode === 'chase';
}

function updatePapi() {
  const whites = flight.speed > 6 ? 2 : 3;
  runway.papi.forEach((box, i) => box.material.color.set(i < whites ? 0xffffff : 0xff4444));
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!shotMode) {
    const input = readInput();
    flight.step(dt, input);
    combat.update(dt, flight, combatActions(), audio, !missions.done && !flight.crashed);
    missions.update(dt, flight, ringSet.rings, audio, combat);
  }
  operator.group.position.copy(flight.position);
  operator.group.rotation.order = 'YXZ';
  operator.group.rotation.y = flight.heading + Math.PI;
  operator.group.rotation.x = 0;
  operator.group.rotation.z = 0;
  operator.blob.position.set(flight.position.x, flight.position.y + 0.06, flight.position.z);
  poseViewmodel();
  water.material.uniforms.uTime.value = t;
  ringSet.rings.forEach((ring, i) => {
    const s = 1 + Math.sin(t * 2.2 + i) * 0.03;
    ring.scale.set(s, s, s);
  });
  updatePapi();
  cameraRig.update(dt, flight, combat);
  hud.update(flight, missions, combat, camera);
  audio.update(flight, missions, combat);
  renderer.render(scene, camera);
}
frame();
window.__lenteraReady = true;
window.__lentera = { flight, combat, missions, cameraRig, audio, terrainHeight };
