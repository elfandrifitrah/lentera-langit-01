// Staged screenshot poses through URL parameters.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';

export function applyShotPose(shot, flight, cameraRig, missions, combat) {
  if (!shot) return false;
  if (shot === 'cover') {
    flight.position.set(-230, 265, -120);
    flight.heading = Math.atan2(-300 - flight.position.x, 320 - flight.position.z);
    flight.pitch = -0.04;
    flight.roll = -0.18;
    flight.speed = 46;
    flight.throttle = 0.8;
    flight.rpm = 0.8;
    flight.airborne = true;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Destroy the installations. T gunner mode, X flares';
    if (combat) {
      combat.stageTracers(flight, new THREE.Vector3(-700, 30, -500));
      combat.boom.position.set(-700, 24, -500);
      combat.boomLife = 0.45;
      combat.boom.material.opacity = 0.8;
      combat.boom.scale.set(2.2, 2.2, 2.2);
    }
    cameraRig.mode = 'chase';
    cameraRig.distance = 30;
    cameraRig.elevation = 0.38;
    cameraRig.lookAhead = 18;
    cameraRig.ready = false;
    return true;
  }
  if (shot === 'cockpit') {
    const r = WORLD.runway;
    flight.position.set(r.x - Math.sin(r.heading) * 300, r.height + 45, r.z - Math.cos(r.heading) * 300);
    flight.heading = r.heading;
    flight.pitch = -0.12;
    flight.roll = 0.05;
    flight.speed = 30;
    flight.throttle = 0.4;
    flight.rpm = 0.4;
    flight.airborne = true;
    flight.flaps = true;
    cameraRig.mode = 'cockpit';
    return true;
  }
  if (shot === 'gunner') {
    flight.position.set(-362, 58, 272);
    flight.heading = Math.atan2(-300 - flight.position.x, 320 - flight.position.z);
    flight.pitch = 0.02;
    flight.roll = -0.42;
    flight.speed = 46;
    flight.throttle = 0.7;
    flight.rpm = 0.7;
    flight.airborne = true;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Gunner mode. Autopilot on. Click fires the side cannons';
    if (combat) {
      combat.gunner = true;
      combat.mouseX = 640;
      combat.mouseY = 380;
      combat.stageTracers(flight, new THREE.Vector3(-300, 16, 320));
      combat.boom.position.set(-300, 14, 320);
      combat.boomLife = 0.45;
      combat.boom.material.opacity = 0.8;
      combat.boom.scale.set(2, 2, 2);
      cameraRig.aimPoint = new THREE.Vector3(-300, 16, 320);
    }
    cameraRig.mode = 'gunner';
    cameraRig.ready = false;
    return true;
  }
  if (shot === 'debrief') {
    const r = WORLD.runway;
    flight.position.set(r.x - Math.sin(r.heading) * 120, r.height + 1.2, r.z - Math.cos(r.heading) * 120);
    flight.heading = r.heading;
    flight.pitch = 0;
    flight.roll = 0;
    flight.speed = 0;
    flight.throttle = 0;
    flight.rpm = 0.08;
    flight.airborne = false;
    flight.fuel = 62;
    flight.hull = 94;
    missions.stage = 3;
    missions.done = true;
    missions.grade = 'S';
    missions.score = 2480;
    missions.message = 'Sortie complete. Grade S. Score 2480';
    cameraRig.mode = 'chase';
    cameraRig.distance = 26;
    cameraRig.ready = false;
    return true;
  }
  return false;
}

export function isShotMode() {
  return new URLSearchParams(window.location.search).has('shot');
}
