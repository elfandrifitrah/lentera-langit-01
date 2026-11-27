// First-person weapon and a third-person operator for the shoulder camera.
import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

function buildOperator() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.62, 0.28, 0x4d5a3e, 0, 1.22, 0));
  g.add(box(0.26, 0.28, 0.24, 0xc49a78, 0, 1.7, 0));
  g.add(box(0.32, 0.14, 0.32, 0x2c3328, 0, 1.88, 0));
  g.add(box(0.16, 0.72, 0.18, 0x3c4634, -0.14, 0.4, 0));
  g.add(box(0.16, 0.72, 0.18, 0x3c4634, 0.14, 0.4, 0));
  g.add(box(0.14, 0.48, 0.16, 0x4d5a3e, -0.34, 1.18, -0.08));
  g.add(box(0.14, 0.48, 0.16, 0x4d5a3e, 0.34, 1.16, -0.16));
  g.add(box(0.07, 0.08, 0.72, 0x1c1e1a, 0.16, 1.18, -0.42));
  return g;
}

function barrel(length, x, y, z, color = 0x1a1c1e) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, length, 8), mat(color));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

function flash(z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),
  );
  mesh.position.set(0, 0.02, z);
  mesh.visible = false;
  return mesh;
}

function buildCarbine() {
  const g = new THREE.Group();
  g.add(box(0.07, 0.09, 0.32, 0x3a342c, 0, 0, 0.16));
  g.add(box(0.055, 0.075, 0.26, 0x2a2e30, 0, 0.02, -0.1));
  g.add(box(0.05, 0.05, 0.2, 0x3a403c, 0, -0.015, -0.08));
  g.add(barrel(0.46, 0, 0.02, -0.4));
  g.add(box(0.038, 0.13, 0.07, 0x202224, 0, -0.09, -0.04));
  g.add(box(0.03, 0.1, 0.045, 0x2a241e, 0, -0.06, 0.06));
  g.add(box(0.018, 0.05, 0.09, 0x121412, 0, 0.075, -0.12));
  g.add(box(0.09, 0.08, 0.26, 0x4e5a42, 0.05, -0.04, 0.04));
  g.add(box(0.08, 0.07, 0.2, 0x4e5a42, -0.01, -0.03, -0.12));
  g.add(box(0.075, 0.06, 0.08, 0x2c312a, 0.04, -0.03, -0.02));
  g.add(box(0.07, 0.055, 0.08, 0x2c312a, 0.02, -0.02, -0.2));
  const muzzle = flash(-0.64);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

function buildPistol() {
  const g = new THREE.Group();
  g.add(box(0.05, 0.07, 0.18, 0x2a2c2e, 0, 0.02, -0.06));
  g.add(barrel(0.16, 0, 0.035, -0.18));
  g.add(box(0.04, 0.12, 0.05, 0x2a241e, 0, -0.06, 0.04));
  g.add(box(0.08, 0.07, 0.16, 0x4e5a42, 0.02, -0.03, 0.02));
  g.add(box(0.07, 0.06, 0.07, 0x2c312a, 0.03, -0.02, -0.02));
  const muzzle = flash(-0.28);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

export function buildAircraft() {
  const group = buildOperator();
  const viewmodel = new THREE.Group();
  const carbine = buildCarbine();
  const pistol = buildPistol();
  pistol.visible = false;
  viewmodel.add(carbine, pistol);
  viewmodel.position.set(0.22, -0.26, -0.52);
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  blob.rotation.x = -Math.PI / 2;
  return { group, viewmodel, blob, carbine, pistol, muzzle: carbine.userData.muzzle };
}
