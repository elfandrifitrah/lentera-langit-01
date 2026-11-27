// Arcade flight model: throttle trim, banked turns, stall, ground effect, fuel, hull.
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
    this.shake = 0;
    this.hitFlash = 0;
    this.gForce = 1;
    this.buffet = 0;
  }

  forward() {
    return new THREE.Vector3(
      Math.sin(this.heading) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.heading) * Math.cos(this.pitch),
    );
  }

  bleed(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt * 0.85);
    this.shake = Math.max(0, this.shake - dt * 1.55);
  }

  step(dt, input) {
    this.bleed(dt);
    if (this.crashed) return;

    this.throttle = clamp(this.throttle + input.throttle * dt * 0.7, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;
    this.fuel = Math.max(0, this.fuel - this.throttle * dt * 0.55);
    const rpmTarget = this.throttle * (this.hull < 40 ? 0.78 : 1);
    this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt * 1.5);

    const pitching = Math.abs(input.pitch) > 0.05;
    const rolling = Math.abs(input.roll) > 0.05;
    if (pitching) this.pitch = clamp(this.pitch + input.pitch * 0.9 * dt, -0.65, 0.62);
    else if (this.airborne) {
      const trim = (this.throttle - 0.45) * 0.16 - (this.flaps ? 0.05 : 0);
      this.pitch += (trim - this.pitch) * Math.min(1, dt * 0.9);
    } else {
      this.pitch += (0 - this.pitch) * Math.min(1, dt * 2.6);
    }
    if (!this.airborne) this.pitch = clamp(this.pitch, -0.02, 0.18);
    if (rolling) this.roll = clamp(this.roll + input.roll * 1.75 * dt, -1.15, 1.15);
    else this.roll *= Math.max(0, 1 - dt * 1.8);

    const speedFactor = clamp(this.speed / 36, 0, 1.45);
    this.heading += Math.sin(this.roll) * speedFactor * dt * 0.95 + input.yaw * dt * (this.airborne ? 0.42 : 0.85);

    const bank = Math.abs(this.roll);
    const load = 1 / Math.max(0.42, Math.cos(bank));
    this.gForce = load;
    const stallSpeed = (this.flaps ? 17 : 23) * Math.sqrt(load);
    this.stalled = this.airborne && this.speed < stallSpeed && this.pitch > 0.05;
    if (this.stalled) {
      this.pitch -= dt * 0.85;
      this.buffet += dt * 26;
      this.roll += Math.sin(this.buffet) * dt * 1.15;
      this.shake = Math.max(this.shake, 0.62);
    }

    const thrust = this.throttle * 34 * (this.hull < 40 ? 0.72 : 1);
    let drag = 0.008 * this.speed * this.speed + (this.flaps ? 1.6 : 0) + (load - 1) * 2.1;
    if (!this.airborne) drag += (this.throttle < 0.2 ? 8 : 1.1) + (input.throttle < 0 ? 14 : 0);
    const gravityAlong = Math.sin(this.pitch) * 9.8;
    this.speed = Math.max(0, this.speed + (thrust - drag - gravityAlong) * dt);

    const prevY = this.position.y;
    if (!this.airborne) {
      const px = this.position.x;
      const pz = this.position.z;
      const ground = Math.max(terrainHeight(px, pz), WORLD.waterLevel);
      const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      this.position.addScaledVector(dir, this.speed * dt);
      const nextGround = Math.max(terrainHeight(this.position.x, this.position.z), WORLD.waterLevel);
      if (nextGround > ground + 8) {
        this.position.x = px;
        this.position.z = pz;
        this.speed *= 0.45;
        this.shake = Math.max(this.shake, 0.45);
      }
      this.position.y = Math.max(terrainHeight(this.position.x, this.position.z), WORLD.waterLevel) + 1.2;
      if (this.speed > stallSpeed + 6 && this.pitch > 0.08) this.airborne = true;
    } else {
      this.position.addScaledVector(this.forward(), this.speed * dt);
      const ground = Math.max(terrainHeight(this.position.x, this.position.z), WORLD.waterLevel);
      let agl = this.position.y - ground;
      if (agl > 0 && agl < 26 && this.verticalSpeed < 0) {
        const sink = Math.min(-this.verticalSpeed, 4);
        const cushion = (1 - agl / 26) * sink * 0.62;
        this.position.y += cushion * dt;
        agl = this.position.y - ground;
      }
      if (agl <= 1.2) this.touchDown(ground);
    }
    this.verticalSpeed = dt > 0 ? (this.position.y - prevY) / dt : 0;
    if (this.hull < 42 && this.airborne) this.shake = Math.max(this.shake, (42 - this.hull) * 0.012);
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
      this.shake = Math.max(this.shake, 0.25);
    } else {
      this.hull -= 34;
      this.speed *= 0.45;
      this.position.y = ground + 2.2;
      this.pitch = Math.max(this.pitch, 0.12);
      this.shake = Math.max(this.shake, 1.6);
      this.hitFlash = 1;
      if (this.hull <= 0) this.crashed = true;
    }
  }

  altitudeFt() { return Math.max(0, this.position.y * 3.281); }
  speedKt() { return this.speed * 1.944; }
  headingDeg() { return ((THREE.MathUtils.radToDeg(this.heading) % 360) + 360) % 360; }
}
