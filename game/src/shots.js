// Staged screenshot poses through URL parameters.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';

export function applyShotPose(shot, flight, cameraRig, missions) {
  if (!shot) return false;
  const ring = RING_PATH[0];
  if (shot === 'cover') {
    const target = RING_PATH[2];
    flight.position.set(60, 195, -60);
    flight.heading = Math.atan2(target.x - flight.position.x, target.z - flight.position.z);
    flight.pitch = 0.02;
    flight.roll = -0.18;
    flight.speed = 42;
    flight.throttle = 0.75;
    flight.rpm = 0.75;
    flight.airborne = true;
    cameraRig.mode = 'chase';
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
  if (shot === 'drop') {
    flight.position.set(WORLD.village.x - 130, 150, WORLD.village.z + 190);
    flight.heading = Math.atan2(130, -190);
    flight.pitch = -0.05;
    flight.roll = 0.22;
    flight.speed = 38;
    flight.throttle = 0.6;
    flight.rpm = 0.6;
    flight.airborne = true;
    missions.stage = 1;
    missions.ringIndex = RING_PATH.length;
    missions.message = 'Drop the crate on the village with Space';
    cameraRig.mode = 'chase';
    cameraRig.ready = false;
    return true;
  }
  if (shot === 'ash') {
    flight.position.set(-500, 320, -200);
    flight.heading = Math.atan2(-750, -650);
    flight.pitch = 0.05;
    flight.roll = -0.3;
    flight.speed = 48;
    flight.throttle = 0.85;
    flight.rpm = 0.85;
    flight.airborne = true;
    cameraRig.mode = 'chase';
    cameraRig.ready = false;
    return true;
  }
  return false;
}

export function isShotMode() {
  return new URLSearchParams(window.location.search).has('shot');
}
