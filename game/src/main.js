// Game entry: scene setup, input, main loop, screenshot staging.
import * as THREE from 'three';
import { WORLD, clamp } from './config.js';
import { buildTerrain, buildWater, buildSky, terrainHeight } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { FlightModel } from './flight-model.js';
import { CameraRig } from './camera-rig.js';
import { buildRunway, buildRings, buildProps, createLanternShow, RING_PATH } from './world-props.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
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
const lanterns = createLanternShow(scene);
const beacon = new THREE.Group();
const beaconBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.1, 1.1, 180, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff8c2e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
);
beaconBeam.position.y = 70;
const beaconMark = new THREE.Mesh(
  new THREE.ConeGeometry(5.5, 9, 4),
  new THREE.MeshBasicMaterial({ color: 0xff8c2e }),
);
beaconMark.rotation.x = Math.PI;
beacon.add(beaconBeam, beaconMark);
scene.add(beacon);

const aircraft = buildAircraft();
scene.add(aircraft.group);
scene.add(aircraft.blob);

const flight = new FlightModel();
const cameraRig = new CameraRig(camera);
const missions = new Missions(scene);
const combat = new Combat(scene);
const audio = new GameAudio();
const hud = new Hud();

const params = new URLSearchParams(window.location.search);
const shotMode = applyShotPose(params.get('shot'), flight, cameraRig, missions, combat);
hud.shotMode = shotMode;
if (params.get('shot') === 'ash') scene.fog = new THREE.Fog(0x9a8f85, 100, 1000);
const briefing = document.getElementById('brief');
if (shotMode && briefing) briefing.style.display = 'none';
if (params.get('debug') === '1') window.__lentera = { flight, combat, missions, cameraRig };

const keys = new Set();
const stick = { pitch: 0, roll: 0 };
const help = document.getElementById('help');
let helpDone = false;
function dismissBrief() {
  if (briefing) briefing.style.display = 'none';
}
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  audio.start();
  dismissBrief();
  if (e.code === 'KeyV' && !combat.gunner) cameraRig.toggle();
  if (e.code === 'KeyT') {
    if (!combat.gunner) {
      cameraRig.prevMode = cameraRig.mode;
      combat.gunner = true;
      cameraRig.mode = 'gunner';
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      combat.gunner = false;
      cameraRig.mode = cameraRig.prevMode === 'cockpit' ? 'cockpit' : 'chase';
    }
    cameraRig.ready = false;
  }
  if (e.code === 'KeyX') combat.deployFlare(flight, audio);
  if (e.code === 'KeyF') flight.flaps = !flight.flaps;
  if (e.code === 'Space') { missions.dropCrate(flight); e.preventDefault(); }
  if (e.code === 'KeyR') {
    flight.reset();
    missions.reset();
    combat.reset();
    helpDone = false;
    cameraRig.mode = 'chase';
    cameraRig.ready = false;
    ringSet.rings.forEach((r) => r.material.color.set(0xff8c2e));
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
let firing = false;
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    stick.roll = clamp(stick.roll + e.movementX * 0.0024, -1, 1);
    stick.pitch = clamp(stick.pitch - e.movementY * 0.002, -1, 1);
  } else {
    combat.mouseX = e.clientX;
    combat.mouseY = e.clientY;
  }
});
window.addEventListener('pointerdown', () => {
  audio.start();
  dismissBrief();
  firing = true;
  if (!shotMode && !combat.gunner && document.pointerLockElement !== canvas) {
    const lock = canvas.requestPointerLock();
    if (lock && lock.catch) lock.catch(() => {});
  }
});
window.addEventListener('pointerup', () => { firing = false; });
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
  input.pitch = clamp(input.pitch + stick.pitch, -1, 1);
  input.roll = clamp(input.roll + stick.roll, -1, 1);
  return input;
}

function updatePapi() {
  const r = WORLD.runway;
  const dist = Math.hypot(flight.position.x - r.x, flight.position.z - r.z);
  const ratio = (flight.position.y - r.height) / Math.max(dist, 1);
  const whites = clamp(Math.round(ratio * 38), 0, 4);
  runway.papi.forEach((box, i) => box.material.color.set(i < whites ? 0xffffff : 0xff4444));
}

function computeAimPoint() {
  if (combat.gunner) {
    const ndc = new THREE.Vector3(
      ((combat.mouseX || window.innerWidth / 2) / window.innerWidth) * 2 - 1,
      -(((combat.mouseY || window.innerHeight / 2) / window.innerHeight) * 2 - 1),
      0.5,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const p = ray.ray.origin.clone();
    const step = ray.ray.direction.clone().multiplyScalar(25);
    for (let i = 0; i < 120; i++) {
      p.add(step);
      if (p.y <= Math.max(terrainHeight(p.x, p.z), 0) + 2) return p;
    }
    return p;
  }
  const ahead = flight.position.clone().addScaledVector(flight.forward(), 420);
  ahead.y = Math.max(terrainHeight(ahead.x, ahead.z), 0) + 4;
  return ahead;
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const aimPoint = shotMode && cameraRig.aimPoint ? cameraRig.aimPoint : computeAimPoint();
  cameraRig.aimPoint = aimPoint;
  if (!shotMode) {
    if (combat.gunner && !flight.crashed) combat.autopilot(dt, flight);
    else flight.step(dt, readInput());
    combat.update(dt, flight, aimPoint, firing || keys.has('KeyG'), audio);
    missions.update(dt, flight, ringSet.rings, audio, combat);
  }
  aircraft.group.position.copy(flight.position);
  aircraft.group.rotation.order = 'YXZ';
  aircraft.group.rotation.y = flight.heading + Math.PI;
  aircraft.group.rotation.x = -flight.pitch;
  aircraft.group.rotation.z = flight.roll;
  for (const prop of aircraft.props) prop.rotation.z += dt * (6 + flight.rpm * 95);
  for (const disc of aircraft.propDiscs) disc.material.opacity = flight.rpm * 0.32;
  aircraft.aileronL.rotation.x = flight.roll * 0.5;
  aircraft.aileronR.rotation.x = -flight.roll * 0.5;
  const groundY = Math.max(terrainHeight(flight.position.x, flight.position.z), 0);
  aircraft.blob.position.set(flight.position.x, groundY + 0.5, flight.position.z);
  aircraft.blob.material.opacity = clamp(0.3 - (flight.position.y - groundY) * 0.001, 0.05, 0.3);
  aircraft.group.visible = cameraRig.mode !== 'cockpit' && cameraRig.mode !== 'gunner';
  const kick = combat.recoil || 0;
  aircraft.gunL.rotation.z = kick * 0.12;
  aircraft.gunR.rotation.z = -kick * 0.12;
  water.material.uniforms.uTime.value = t;
  if (missions.pendingBurst) {
    lanterns.burst(missions.pendingBurst.x, missions.pendingBurst.y, missions.pendingBurst.z);
    missions.pendingBurst = null;
  }
  lanterns.update(dt);
  const spring = Math.max(0, 1 - dt * 3.4);
  stick.pitch *= spring;
  stick.roll *= spring;
  ringSet.rings.forEach((ring, i) => {
    const next = missions.stage === 0 && i === missions.ringIndex;
    const pulse = next ? 4.6 : 2.4;
    const amp = next ? 0.1 : 0.035;
    const base = next ? 1.12 : 1;
    const s = base + Math.sin(t * pulse + i) * amp;
    ring.scale.set(s, s, s);
  });
  if (flight.airborne) helpDone = true;
  if (help) help.style.display = shotMode || helpDone ? 'none' : '';
  const tgt = missions.currentTarget(flight, combat);
  beacon.visible = !shotMode && !missions.done;
  beacon.position.set(tgt.x, tgt.y || 40, tgt.z);
  beaconMark.position.y = 16 + Math.sin(t * 3) * 2.4;
  updatePapi();
  cameraRig.update(dt, flight, aircraft.group);
  hud.update(flight, missions, combat, camera, aimPoint);
  audio.update(flight, missions, combat);
  renderer.render(scene, camera);
}
frame();
window.__lenteraReady = true;
