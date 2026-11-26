// Arcade flight model: throttle, pitch, roll, stall, fuel, hull.
import * as THREE from 'three';
import { WORLD, clamp } from './config.js';
import { terrainHeight } from './terrain.js';

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    const r = WORLD.runway;
    this.position = new THREE.Vector3(r.x - Math.sin(r.heading) * 200, r.height + 1.2, r.z - Math.cos(r.heading) * 200);
    this.heading = r.heading;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.hull = 100;
    this.flaps = false;
    this.airborne = false;
    this.crashed = false;
    this.landed = false;
    this.stalled = false;
    this.verticalSpeed = 0;
    this.rpm = 0;
  }

  forward() {
    return new THREE.Vector3(
      Math.sin(this.heading) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.heading) * Math.cos(this.pitch),
    );
  }

  step(dt, input) {
    if (this.crashed) return;
    this.throttle = clamp(this.throttle + input.throttle * dt * 0.7, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;
    this.fuel = Math.max(0, this.fuel - this.throttle * dt * 0.55);
    this.rpm = this.throttle;

    const pitchRate = input.pitch * 0.85;
    const rollRate = input.roll * 1.7;
    this.pitch = clamp(this.pitch + pitchRate * dt, -0.65, 0.6);
    this.roll = clamp(this.roll + rollRate * dt, -1.15, 1.15);
    if (input.roll === 0) this.roll *= Math.max(0, 1 - dt * 1.6);
    this.heading += Math.sin(this.roll) * clamp(this.speed / 40, 0, 1.4) * dt * 0.9 + input.yaw * dt * 0.4;

    const stallSpeed = this.flaps ? 17 : 23;
    this.stalled = this.airborne && this.speed < stallSpeed && this.pitch > 0.08;
    if (this.stalled) this.pitch -= dt * 0.9;

    const thrust = this.throttle * 34;
    const drag = 0.008 * this.speed * this.speed + (this.flaps ? 1.6 : 0);
    const gravityAlong = Math.sin(this.pitch) * 9.8;
    this.speed = Math.max(0, this.speed + (thrust - drag - gravityAlong) * dt);

    const prevY = this.position.y;
    if (!this.airborne) {
      const ground = terrainHeight(this.position.x, this.position.z);
      this.position.y = Math.max(ground, WORLD.waterLevel) + 1.2;
      const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      this.position.addScaledVector(dir, this.speed * dt);
      if (this.speed > stallSpeed + 4 && this.pitch > 0.06) this.airborne = true;
    } else {
      this.position.addScaledVector(this.forward(), this.speed * dt);
      const ground = Math.max(terrainHeight(this.position.x, this.position.z), WORLD.waterLevel);
      const agl = this.position.y - ground;
      if (agl < 6) this.position.y += dt * 1.1;
      if (agl <= 1.2) this.touchDown(ground);
    }
    this.verticalSpeed = dt > 0 ? (this.position.y - prevY) / dt : 0;
  }

  touchDown(ground) {
    const gentle = this.verticalSpeed > -4.5 && Math.abs(this.pitch) < 0.22 && Math.abs(this.roll) < 0.35;
    const onWater = ground <= WORLD.waterLevel + 0.1;
    if (gentle && this.speed < 46) {
      this.airborne = false;
      this.landed = true;
      this.position.y = ground + 1.2;
      this.pitch *= 0.4;
      this.roll *= 0.4;
      if (onWater) this.speed = Math.min(this.speed, 8);
    } else {
      this.hull -= 34;
      this.speed *= 0.45;
      this.position.y = ground + 2.2;
      this.pitch = Math.max(this.pitch, 0.12);
      if (this.hull <= 0) this.crashed = true;
    }
  }

  altitudeFt() { return Math.max(0, this.position.y * 3.281); }
  speedKt() { return this.speed * 1.944; }
  headingDeg() { return ((THREE.MathUtils.radToDeg(this.heading) % 360) + 360) % 360; }
}
