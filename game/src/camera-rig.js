// Isometric diorama chase camera and cockpit camera.
import * as THREE from 'three';
import { clamp } from './config.js';

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // 35.264 degrees
const ISO_DISTANCE = 30;
const ISO_AZIMUTH_OFFSET = 0.35;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.smoothed = new THREE.Vector3();
    this.ready = false;
  }

  toggle() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.ready = false;
  }

  setFov(fov) {
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt, flight, aircraftGroup) {
    const pos = flight.position;
    if (this.mode === 'cockpit') {
      this.setFov(62);
      const eye = new THREE.Vector3(0, 1.55, 1.3).applyEuler(aircraftGroup.rotation).add(pos);
      this.camera.position.copy(eye);
      const look = flight.forward().multiplyScalar(60).add(eye);
      this.camera.up.set(Math.sin(flight.roll) * -1, Math.cos(flight.roll), 0);
      this.camera.lookAt(look);
      return;
    }
    this.setFov(52);
    const azimuth = flight.heading + Math.PI - ISO_AZIMUTH_OFFSET;
    const horiz = Math.cos(ISO_ELEVATION) * ISO_DISTANCE;
    const desired = pos.clone().add(new THREE.Vector3(
      Math.sin(azimuth) * horiz,
      Math.sin(ISO_ELEVATION) * ISO_DISTANCE,
      Math.cos(azimuth) * horiz,
    ));
    if (!this.ready) { this.smoothed.copy(desired); this.ready = true; }
    const k = clamp(dt * 3.2, 0, 1);
    this.smoothed.lerp(desired, k);
    this.camera.position.copy(this.smoothed);
    this.camera.up.set(0, 1, 0);
    const look = pos.clone().addScaledVector(flight.forward(), 12).add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(look);
  }
}
