// Staged screenshots. Poses put the operator on the ground, in sights.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';
import { terrainHeight } from './terrain.js';

function place(flight, x, z, lookX, lookZ, pitch) {
  flight.position.set(x, Math.max(terrainHeight(x, z), 0), z);
  flight.heading = Math.atan2(lookX - x, lookZ - z);
  flight.lookPitch = pitch;
  flight.pitch = pitch;
  flight.recoilPitch = 0;
  flight.recoilYaw = 0;
  flight.speed = 0;
  flight.airborne = false;
  flight.landed = true;
  flight.crouch = false;
  flight.prone = false;
}

export function applyShotPose(shot, flight, cameraRig, missions, combat) {
  if (!shot) return false;
  if (shot === 'cover') {
    place(flight, 218, 560, 206, 500, -0.04);
    cameraRig.mode = 'chase';
    cameraRig.fov = 60;
    cameraRig.ready = false;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Clear the compounds. 4 still standing';
    if (combat) {
      combat.poseContact(flight);
      combat.stageTracers(flight, new THREE.Vector3(200, terrainHeight(200, 500) + 1.4, 500));
      combat.muzzleTimer = 0.2;
    }
    return true;
  }
  if (shot === 'cockpit' || shot === 'fps') {
    place(flight, 218, 552, 206, 500, -0.05);
    cameraRig.mode = 'fps';
    cameraRig.fov = 70;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Clear the compounds. 4 still standing';
    if (combat) {
      combat.poseContact(flight);
      combat.ads = false;
    }
    return true;
  }
  if (shot === 'gunner' || shot === 'ads') {
    place(flight, 216, 544, 206, 500, -0.03);
    cameraRig.mode = 'fps';
    cameraRig.fov = 46;
    cameraRig.camera.fov = 46;
    cameraRig.camera.updateProjectionMatrix();
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Contact. MG West is still up';
    if (combat) {
      combat.ads = true;
      combat.poseContact(flight);
      combat.contact = 2;
    }
    return true;
  }
  if (shot === 'debrief') {
    const r = WORLD.runway;
    place(flight, r.x - 20, r.z - 30, r.x, r.z - 80, -0.02);
    cameraRig.mode = 'fps';
    cameraRig.fov = 70;
    flight.hull = 78;
    missions.stage = 3;
    missions.done = true;
    missions.grade = 'A';
    missions.score = 2140;
    missions.message = 'Raid complete. Grade A. Score 2140';
    if (combat) combat.armor = 20;
    return true;
  }
  return false;
}

export function isShotMode() {
  return new URLSearchParams(window.location.search).has('shot');
}
