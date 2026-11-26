// One height function builds the mesh and answers collision queries.
import * as THREE from 'three';
import { WORLD, clamp } from './config.js';

function hashNoise(ix, iz) {
  let h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise(x, z, scale) {
  const gx = x / scale, gz = z / scale;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hashNoise(ix, iz), b = hashNoise(ix + 1, iz);
  const c = hashNoise(ix, iz + 1), d = hashNoise(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function islandBump(x, z, cx, cz, radius, height) {
  const dx = x - cx, dz = z - cz;
  const d2 = (dx * dx + dz * dz) / (radius * radius);
  return height * Math.exp(-d2 * 2.2);
}

function ridgedNoise(x, z, scale) {
  const n = valueNoise(x, z, scale);
  return 1 - Math.abs(2 * n - 1);
}

function peak(x, z, cx, cz, radius, height) {
  const d = Math.hypot(x - cx, z - cz) / radius;
  return height * Math.max(0, 1 - d) ** 1.7;
}

export function terrainHeight(x, z) {
  let h = -16;
  // Rolling green hills and coastal shelves.
  h += islandBump(x, z, 650, 950, 950, 52);
  h += islandBump(x, z, -350, 1250, 850, 46);
  h += islandBump(x, z, 1500, 700, 900, 38);
  h += islandBump(x, z, 100, -1700, 1050, 50);
  h += islandBump(x, z, -600, 200, 750, 40);
  h += (valueNoise(x, z, 520) - 0.5) * 34 + (valueNoise(x, z, 170) - 0.5) * 12;
  // Snow mountain chain along the west, with a ridged crest.
  const crest = Math.abs(x + 1450 - 0.22 * z);
  const chainMask = clamp(1 - crest / 900, 0, 1);
  h += chainMask * (150 + ridgedNoise(x, z, 380) * 230);
  h += peak(x, z, -1250, -850, 620, 300);
  h += peak(x, z, -1650, 150, 560, 270);
  h += peak(x, z, -1050, 950, 520, 210);
  h += peak(x, z, 1500, -1500, 600, 190);
  // A still lake in a hill basin, fed by a carved river valley.
  const lakeD = Math.hypot(x - 350, z + 450);
  const lakeMask = clamp(1 - (lakeD - 260) / 320, 0, 1);
  h = h * (1 - lakeMask) + (-7) * lakeMask;
  const riverD = Math.abs((z + 450) - 0.28 * (x - 350)) / 1.04;
  const riverMask = clamp(1 - riverD / 110, 0, 1) * clamp((x + 900) / 500, 0, 1) * clamp((500 - x) / 500, 0, 1);
  h -= riverMask * 22 * clamp((h + 8) / 30, 0, 1);
  // Fjord cut on the south coast.
  h -= 30 * Math.exp(-(((x - 900) / 150) ** 2)) * clamp((-z - 600) / 500, 0, 1);
  const r = WORLD.runway;
  const rd = Math.hypot(x - r.x, z - r.z);
  const flat = clamp(1 - (rd - 320) / 260, 0, 1);
  h = h * (1 - flat) + r.height * flat;
  return h;
}

function terrainColor(h, slope, x, z) {
  if (h < 1.2) return [0.9, 0.8, 0.57];
  if (h > 300) return [0.96, 0.97, 0.99];
  if (h > 235 && slope < 0.75) return [0.88, 0.9, 0.93];
  if (slope > 0.6) return [0.42, 0.38, 0.34];
  if (h > 160) return [0.45, 0.52, 0.36];
  const patch = valueNoise(x, z, 240);
  if (patch > 0.62) return [0.42, 0.66, 0.3];
  if (patch < 0.36) return [0.24, 0.52, 0.26];
  return [0.32, 0.6, 0.3];
}

export function buildTerrain() {
  const seg = 200;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const slope = Math.abs(terrainHeight(x + 24, z) - h) / 24 + Math.abs(terrainHeight(x, z + 24) - h) / 24;
    const [r, g, b] = terrainColor(h, slope, x, z);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return new THREE.Mesh(geo, mat);
}

export function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 1.6, WORLD.size * 1.6, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying float vWave;
      void main(){ vec3 p = position; vWave = sin(p.x*0.02 + uTime*1.4) * cos(p.z*0.017 + uTime); p.y += vWave * 0.7;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `varying float vWave;
      void main(){ vec3 deep = vec3(0.05,0.32,0.5); vec3 lite = vec3(0.25,0.62,0.78);
      gl_FragColor = vec4(mix(deep, lite, vWave*0.5+0.5), 0.92); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.waterLevel;
  return mesh;
}

export function buildSky() {
  const geo = new THREE.SphereGeometry(9000, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir;
      void main(){ float t = clamp(vDir.y*1.6+0.25, 0.0, 1.0);
      vec3 horizon = vec3(1.0,0.72,0.42); vec3 zenith = vec3(0.35,0.62,0.92);
      vec3 col = mix(horizon, zenith, t);
      vec3 sunDir = normalize(vec3(-0.55,0.28,-0.4));
      float sun = pow(max(dot(vDir, sunDir),0.0), 220.0);
      col += vec3(1.0,0.85,0.55) * sun * 1.6;
      gl_FragColor = vec4(col,1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}
