// Ground movement for the raid. The class name stays so the rest of the
// loop can keep reading position, heading, hull, and the eye point.
import * as THREE from 'three';
import { WORLD, clamp, lerp } from './config.js';
import { terrainHeight } from './terrain.js';

const WALK = 5.6;
const SPRINT = 9.4;
const CROUCH = 3.05;
const PRONE = 1.65;

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    const x = 520;
    const z = 800;
    this.position = new THREE.Vector3(x, Math.max(terrainHeight(x, z), 0), z);
    this.heading = Math.atan2(200 - x, 500 - z);
    this.lookPitch = -0.02;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lean = 0;
    this.pitch = this.lookPitch;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.stamina = 100;
    this.hull = 100;
    this.flaps = false;
    this.crouch = false;
    this.crouchLatched = false;
    this.prone = false;
    this.airborne = false;
    this.crashed = false;
    this.landed = true;
    this.stalled = false;
    this.verticalSpeed = 0;
    this.rpm = 0;
    this.vy = 0;
    this.velX = 0;
    this.velZ = 0;
    this.bob = 0;
    this.sprinting = false;
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  aimDir() {
    const pitch = this.lookPitch + this.recoilPitch;
    const yaw = this.heading + this.recoilYaw;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    return dir.normalize();
  }

  eyeHeight() {
    if (this.prone) return 0.4;
    if (this.crouch) return 1.05;
    return 1.68;
  }

  eyePosition() {
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);
    return new THREE.Vector3(
      this.position.x + rightX * this.lean * 0.34,
      this.position.y + this.eyeHeight(),
      this.position.z + rightZ * this.lean * 0.34,
    );
  }

  step(dt, input) {
    if (this.crashed) return;
    this.heading += input.yaw || 0;
    this.lookPitch = clamp(this.lookPitch + (input.pitch || 0), -1.15, 1.05);

    if (input.proneToggle) this.prone = !this.prone;
    if (input.crouchToggle) this.crouchLatched = !this.crouchLatched;
    if (this.prone) this.crouchLatched = false;
    this.crouch = this.prone || this.crouchLatched || !!input.crouchHeld;
    this.flaps = this.crouch;

    this.lean = lerp(this.lean, input.lean || 0, clamp(dt * 12, 0, 1));
    this.roll = this.lean;
    this.recoilPitch = lerp(this.recoilPitch, 0, clamp(dt * 8.5, 0, 1));
    this.recoilYaw = lerp(this.recoilYaw, 0, clamp(dt * 7, 0, 1));
    this.pitch = this.lookPitch + this.recoilPitch;

    const wishF = input.forward || 0;
    const wishS = input.strafe || 0;
    const wishLen = Math.hypot(wishF, wishS);
    const nf = wishLen > 1 ? wishF / wishLen : wishF;
    const ns = wishLen > 1 ? wishS / wishLen : wishS;
    const ads = !!input.ads;
    const canSprint = !!input.sprint && nf > 0.5 && this.stamina > 1 && !this.crouch && !ads && !this.airborne;
    this.sprinting = canSprint;
    if (canSprint) this.stamina = Math.max(0, this.stamina - dt * 22);
    else this.stamina = Math.min(100, this.stamina + dt * (this.crouch ? 18 : 13));
    this.fuel = this.stamina;
    this.stalled = this.stamina <= 0.5;
    this.throttle = canSprint ? 1 : (wishLen > 0.05 ? 0.4 : 0);

    let maxSpeed = WALK;
    if (this.prone) maxSpeed = PRONE;
    else if (this.crouch) maxSpeed = CROUCH;
    else if (ads) maxSpeed = CROUCH;
    else if (canSprint) maxSpeed = SPRINT;
    if (nf < -0.1) maxSpeed *= 0.72;

    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);
    const targetX = (fwdX * nf + rightX * ns) * maxSpeed;
    const targetZ = (fwdZ * nf + rightZ * ns) * maxSpeed;
    const rate = wishLen > 0.05 ? 38 : 60;
    const k = clamp(dt * rate, 0, 1);
    this.velX = lerp(this.velX, targetX, k);
    this.velZ = lerp(this.velZ, targetZ, k);

    if (input.jump && !this.airborne && !this.prone && !this.crouch) {
      this.vy = 7.2;
      this.airborne = true;
      this.landed = false;
    }

    const prevY = this.position.y;
    const nextX = this.position.x + this.velX * dt;
    const nextZ = this.position.z + this.velZ * dt;
    const here = terrainHeight(this.position.x, this.position.z);
    const there = terrainHeight(nextX, nextZ);
    const limit = WORLD.size * 0.48;
    const blocked = there < 0.35 || (!this.airborne && there - here > 1.2) || Math.abs(nextX) > limit || Math.abs(nextZ) > limit;
    if (!blocked) {
      this.position.x = nextX;
      this.position.z = nextZ;
    } else {
      this.velX = 0;
      this.velZ = 0;
    }

    if (this.airborne) {
      this.vy -= 26 * dt;
      this.position.y += this.vy * dt;
    }
    const ground = Math.max(terrainHeight(this.position.x, this.position.z), 0);
    if (!this.airborne || this.position.y <= ground) {
      if (this.airborne && this.vy < -13) this.hull = Math.max(0, this.hull - (Math.abs(this.vy) - 13) * 3.2);
      this.position.y = ground;
      this.vy = 0;
      this.airborne = false;
      this.landed = true;
      if (this.hull <= 0) this.crashed = true;
    }
    this.verticalSpeed = dt > 0 ? (this.position.y - prevY) / dt : 0;
    this.speed = Math.hypot(this.velX, this.velZ);
    this.rpm = clamp(this.speed / SPRINT, 0, 1);
    if (this.speed > 0.7 && !this.airborne) this.bob += dt * this.speed * 1.15;
  }

  altitudeFt() { return Math.max(0, this.position.y * 3.281); }
  speedKt() { return this.speed * 1.944; }
  headingDeg() { return ((THREE.MathUtils.radToDeg(this.heading) % 360) + 360) % 360; }
}
