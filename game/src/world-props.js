// Runway, rings, lanterns, trees, houses, boat, and clouds.
import * as THREE from 'three';
import { WORLD, createSeededRandom } from './config.js';
import { terrainHeight } from './terrain.js';

export const RING_PATH = [
  { x: 650, y: 90, z: 250 },
  { x: 150, y: 130, z: -150 },
  { x: -450, y: 170, z: -350 },
  { x: -950, y: 230, z: -600 },
  { x: -350, y: 150, z: 650 },
];

export function buildRunway() {
  const group = new THREE.Group();
  const r = WORLD.runway;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.length),
    new THREE.MeshLambertMaterial({ color: 0x33383e }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(r.x, r.height + 0.4, r.z);
  strip.rotation.z = r.heading;
  group.add(strip);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), white);
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = r.heading;
    const off = new THREE.Vector3(i * 8, 0, -r.length / 2 + 30).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.heading);
    bar.position.set(r.x + off.x, r.height + 0.55, r.z + off.z);
    group.add(bar);
  }
  const lightGeo = new THREE.SphereGeometry(0.8, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i < 10; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      const off = new THREE.Vector3(side * (r.width / 2 + 2), 0, -r.length / 2 + i * (r.length / 9)).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.heading);
      lamp.position.set(r.x + off.x, r.height + 1, r.z + off.z);
      group.add(lamp);
    }
  }
  const papi = [];
  for (let i = 0; i < 4; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    const off = new THREE.Vector3(-r.width / 2 - 8 - i * 3.4, 0, -r.length / 2 + 60).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.heading);
    box.position.set(r.x + off.x, r.height + 1, r.z + off.z);
    group.add(box);
    papi.push(box);
  }
  return { group, papi };
}

export function buildRings() {
  const group = new THREE.Group();
  const rings = [];
  for (const p of RING_PATH) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(16, 1.4, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8c2e }),
    );
    ring.position.set(p.x, p.y, p.z);
    group.add(ring);
    rings.push(ring);
  }
  return { group, rings };
}

export function buildProps() {
  const group = new THREE.Group();
  const rand = createSeededRandom(42);
  const treeGeo = new THREE.ConeGeometry(3.2, 11, 7);
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2e7d46, flatShading: true });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, 700);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < 4000 && placed < 700; i++) {
    const x = (rand() - 0.5) * 5600, z = (rand() - 0.5) * 5600;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 175) continue;
    if (Math.hypot(x - WORLD.runway.x, z - WORLD.runway.z) < 340) continue;
    dummy.position.set(x, h + 5, z);
    const s = 0.7 + rand() * 1.1;
    dummy.scale.set(s, s, s);
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    trees.setMatrixAt(placed++, dummy.matrix);
  }
  trees.count = placed;
  group.add(trees);

  const houseGeo = new THREE.BoxGeometry(9, 6, 8);
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xe8d8b0 });
  const houses = new THREE.InstancedMesh(houseGeo, houseMat, 60);
  for (let i = 0; i < 60; i++) {
    const x = WORLD.village.x + (rand() - 0.5) * 420;
    const z = WORLD.village.z + (rand() - 0.5) * 420;
    dummy.position.set(x, terrainHeight(x, z) + 3, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    houses.setMatrixAt(i, dummy.matrix);
  }
  group.add(houses);

  const lanternGeo = new THREE.SphereGeometry(1.6, 10, 8);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, 90);
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const x = -1400 + t * 2600 + (rand() - 0.5) * 220;
    const z = 300 - t * 900 + (rand() - 0.5) * 220;
    dummy.position.set(x, Math.max(terrainHeight(x, z), 0) + 26 + rand() * 30, z);
    dummy.scale.set(1, 1.25, 1);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    lanterns.setMatrixAt(i, dummy.matrix);
  }
  group.add(lanterns);

  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 5), new THREE.MeshLambertMaterial({ color: 0xb23a2e }));
  hull.position.y = 1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
  cabin.position.set(-2, 3.5, 0);
  boat.add(hull, cabin);
  boat.position.set(WORLD.boat.x, 0, WORLD.boat.z);
  group.add(boat);

  const cloudGeo = new THREE.SphereGeometry(30, 10, 8);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 60);
  for (let i = 0; i < 60; i++) {
    dummy.position.set((rand() - 0.5) * 6000, 320 + rand() * 180, (rand() - 0.5) * 6000);
    dummy.scale.set(1.6 + rand() * 2, 0.45, 1 + rand());
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  group.add(clouds);
  return group;
}
