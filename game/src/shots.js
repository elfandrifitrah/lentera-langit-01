// Staged screenshot poses through URL parameters.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';

export function applyShotPose(shot, flight, cameraRig, missions, combat) {
  if (!shot) return false;
  if (shot === 'cover') {
    const ring = RING_PATH[0];
    const heading = 0.15;
    const lead = 155;
    flight.position.set(ring.x - Math.sin(heading) * lead, ring.y + 8, ring.z - Math.cos(heading) * lead);
    flight.heading = heading;
    flight.pitch = -0.03;
    flight.roll = -0.32;
    flight.speed = 48;
    flight.throttle = 0.72;
    flight.rpm = 0.72;
    flight.airborne = true;
    missions.stage = 0;
    missions.ringIndex = 0;
    missions.message = 'Light the rings · 1 of 5';
    cameraRig.mode = 'chase';
    cameraRig.distance = 26;
    cameraRig.elevation = 0.34;
    cameraRig.lookAhead = 16;
    cameraRig.ready = false;
    return true;
  }
  if (shot === 'cockpit') {
    const r = WORLD.runway;
    flight.position.set(r.x - Math.sin(r.heading) * 200, r.height + 28, r.z - Math.cos(r.heading) * 200);
    flight.heading = r.heading;
    flight.pitch = -0.09;
    flight.roll = 0.03;
    flight.speed = 34;
    flight.throttle = 0.42;
    flight.rpm = 0.42;
    flight.airborne = true;
    flight.flaps = true;
    flight.verticalSpeed = -3;
    missions.stage = 3;
    missions.message = 'Runway ahead. Flaps down';
    cameraRig.mode = 'cockpit';
    return true;
  }
  if (shot === 'gunner') {
    const target = new THREE.Vector3(-300, 16, 320);
    flight.position.set(target.x + 42, 34, target.z + 28);
    flight.heading = Math.atan2(target.x - flight.position.x, target.z - flight.position.z);
    flight.pitch = -0.12;
    flight.roll = -0.2;
    flight.speed = 40;
    flight.throttle = 0.64;
    flight.rpm = 0.64;
    flight.airborne = true;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Silence the guns · AAA battery west';
    if (combat) {
      combat.gunner = true;
      combat.mouseX = 640;
      combat.mouseY = 400;
      combat.stageTracers(flight, target);
      combat.boom.position.copy(target);
      combat.boomLife = 0.42;
      combat.boom.material.opacity = 0.7;
      combat.boom.scale.set(1.4, 1.4, 1.4);
      cameraRig.aimPoint = target;
    }
    cameraRig.mode = 'gunner';
    cameraRig.ready = false;
    return true;
  }
  if (shot === 'debrief') {
    const r = WORLD.runway;
    flight.position.set(r.x - Math.sin(r.heading) * 80, r.height + 1.2, r.z - Math.cos(r.heading) * 80);
    flight.heading = r.heading;
    flight.pitch = 0;
    flight.roll = 0;
    flight.speed = 0;
    flight.throttle = 0;
    flight.rpm = 0.08;
    flight.airborne = false;
    flight.landed = true;
    flight.fuel = 62;
    flight.hull = 94;
    missions.stage = 3;
    missions.done = true;
    missions.grade = 'S';
    missions.score = 2480;
    missions.message = 'Grade S · Score 2480';
    cameraRig.mode = 'chase';
    cameraRig.distance = 30;
    cameraRig.elevation = 0.55;
    cameraRig.lookAhead = 0;
    cameraRig.ready = false;
    return true;
  }
  return false;
}

export function isShotMode() {
  return new URLSearchParams(window.location.search).has('shot');
}
