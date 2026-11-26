// Game entry: scene setup, input, main loop, screenshot staging.
import * as THREE from 'three';
import { WORLD, clamp } from './config.js';
import { buildTerrain, buildWater, buildSky, terrainHeight } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { FlightModel } from './flight-model.js';
import { CameraRig } from './camera-rig.js';
import { buildRunway, buildRings, buildProps, RING_PATH } from './world-props.js';
import { Missions } from './missions.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { applyShotPose, isShotMode } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf2c184, 900, 5200);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 20000);

scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a6a45, 0.9));
const sun = new THREE.DirectionalLight(0xffe3b3, 1.6);
sun.position.set(-800, 600, -500);
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
  const prev = i === 0 ? { x: 650, y: 40, z: 900 } : RING_PATH[i - 1];
  ring.lookAt(prev.x, prev.y, prev.z);
});
scene.add(buildProps());

const aircraft = buildAircraft();
scene.add(aircraft.group);
scene.add(aircraft.blob);

const flight = new FlightModel();
const cameraRig = new CameraRig(camera);
const missions = new Missions(scene);
const audio = new GameAudio();
const hud = new Hud();

const params = new URLSearchParams(window.location.search);
const shotMode = applyShotPose(params.get('shot'), flight, cameraRig, missions);
if (params.get('shot') === 'ash') scene.fog = new THREE.Fog(0x9a8f85, 100, 1000);

const keys = new Set();
let mouseSteer = { pitch: 0, roll: 0, active: false };
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  audio.start();
  if (e.code === 'KeyV') cameraRig.toggle();
  if (e.code === 'KeyF') flight.flaps = !flight.flaps;
  if (e.code === 'Space') { missions.dropCrate(flight); e.preventDefault(); }
  if (e.code === 'KeyR') { flight.reset(); missions.reset(); ringSet.rings.forEach((r) => r.material.color.set(0xff8c2e)); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('pointermove', (e) => {
  mouseSteer.active = true;
  mouseSteer.roll = clamp((e.clientX / window.innerWidth - 0.5) * 2.4, -1, 1);
  mouseSteer.pitch = clamp((0.5 - e.clientY / window.innerHeight) * 2.0, -1, 1);
});
window.addEventListener('pointerdown', () => audio.start());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput() {
  const input = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
  if (keys.has('KeyW') || keys.has('ShiftLeft')) input.throttle += 1;
  if (keys.has('KeyS') || keys.has('ControlLeft')) input.throttle -= 1;
  if (keys.has('ArrowUp')) input.pitch += 1;
  if (keys.has('ArrowDown')) input.pitch -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.roll -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.roll += 1;
  if (keys.has('KeyQ')) input.yaw -= 1;
  if (keys.has('KeyE')) input.yaw += 1;
  if (input.pitch === 0 && mouseSteer.active) input.pitch = mouseSteer.pitch;
  if (input.roll === 0 && mouseSteer.active) input.roll = mouseSteer.roll;
  return input;
}

function updatePapi() {
  const r = WORLD.runway;
  const dist = Math.hypot(flight.position.x - r.x, flight.position.z - r.z);
  const ratio = (flight.position.y - r.height) / Math.max(dist, 1);
  const whites = clamp(Math.round(ratio * 38), 0, 4);
  runway.papi.forEach((box, i) => box.material.color.set(i < whites ? 0xffffff : 0xff4444));
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!shotMode) {
    flight.step(dt, readInput());
    missions.update(dt, flight, ringSet.rings, audio);
  }
  aircraft.group.position.copy(flight.position);
  aircraft.group.rotation.order = 'YXZ';
  aircraft.group.rotation.y = flight.heading + Math.PI;
  aircraft.group.rotation.x = -flight.pitch;
  aircraft.group.rotation.z = flight.roll;
  aircraft.prop.rotation.z += dt * (6 + flight.rpm * 95);
  aircraft.propDisc.material.opacity = flight.rpm * 0.32;
  aircraft.aileronL.rotation.x = flight.roll * 0.5;
  aircraft.aileronR.rotation.x = -flight.roll * 0.5;
  const groundY = Math.max(terrainHeight(flight.position.x, flight.position.z), 0);
  aircraft.blob.position.set(flight.position.x, groundY + 0.5, flight.position.z);
  aircraft.blob.material.opacity = clamp(0.3 - (flight.position.y - groundY) * 0.001, 0.05, 0.3);
  aircraft.group.visible = cameraRig.mode !== 'cockpit';
  water.material.uniforms.uTime.value = t;
  ringSet.rings.forEach((ring, i) => {
    const s = 1 + Math.sin(t * 2.4 + i) * 0.04;
    ring.scale.set(s, s, s);
  });
  updatePapi();
  cameraRig.update(dt, flight, aircraft.group);
  hud.update(flight, missions);
  audio.update(flight, missions);
  renderer.render(scene, camera);
}
frame();
window.__lenteraReady = true;
