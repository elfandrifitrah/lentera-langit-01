// Isometric diorama chase camera, cockpit camera, and the gunner sight.
import * as THREE from 'three';
import { clamp } from './config.js';

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);
const ISO_DISTANCE = 36;
const ISO_AZIMUTH_OFFSET = 0.35;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.distance = ISO_DISTANCE;
    this.elevation = ISO_ELEVATION;
    this.lookAhead = 12;
    this.smoothed = new THREE.Vector3();
    this.ready = false;
  }

  toggle() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.ready = false;
  }

  setFov(fov) {
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  kick(flight) {
    const s = flight.shake || 0;
    if (s < 0.03) return;
    this.camera.position.x += (Math.random() - 0.5) * s * 1.7;
    this.camera.position.y += (Math.random() - 0.5) * s * 1.15;
    this.camera.position.z += (Math.random() - 0.5) * s * 1.7;
  }

  update(dt, flight, aircraftGroup) {
    const pos = flight.position;
    if (this.mode === 'gunner') {
      this.setFov(50);
      const look = this.aimPoint || pos.clone().addScaledVector(flight.forward(), 200);
      const toAim = look.clone().sub(pos);
      const sideSign = Math.sign(toAim.x * Math.cos(flight.heading) - toAim.z * Math.sin(flight.heading)) || 1;
      const side = new THREE.Vector3(Math.cos(flight.heading), 0, -Math.sin(flight.heading)).multiplyScalar(sideSign * 2.4);
      this.camera.position.copy(pos).add(side).add(new THREE.Vector3(0, 0.4, 0));
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(look);
      this.kick(flight);
      return;
    }
    if (this.mode === 'cockpit') {
      this.setFov(62);
      const eye = new THREE.Vector3(0, 1.55, 1.3).applyEuler(aircraftGroup.rotation).add(pos);
      this.camera.position.copy(eye);
      const look = flight.forward().multiplyScalar(60).add(eye);
      this.camera.up.set(Math.sin(flight.roll) * -1, Math.cos(flight.roll), 0);
      this.camera.lookAt(look);
      this.kick(flight);
      return;
    }
    this.setFov(50 + clamp(flight.speed, 0, 75) * 0.1);
    const azimuth = flight.heading + Math.PI - ISO_AZIMUTH_OFFSET;
    const horiz = Math.cos(this.elevation) * this.distance;
    const desired = pos.clone().add(new THREE.Vector3(
      Math.sin(azimuth) * horiz,
      Math.sin(this.elevation) * this.distance,
      Math.cos(azimuth) * horiz,
    ));
    if (!this.ready) { this.smoothed.copy(desired); this.ready = true; }
    const k = clamp(dt * 3.4, 0, 1);
    this.smoothed.lerp(desired, k);
    this.camera.position.copy(this.smoothed);
    const lean = Math.sin(flight.roll) * 0.22;
    this.camera.up.set(lean, 1, 0);
    const lead = this.lookAhead + flight.speed * 0.1;
    const look = pos.clone().addScaledVector(flight.forward(), lead).add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(look);
    this.kick(flight);
  }
}
