// Hercules style four-engine gunship: high wing, side cannons, flare pods.
import * as THREE from 'three';

function mat(color, flat = true) {
  return new THREE.MeshLambertMaterial({ color, flatShading: flat });
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

export function buildAircraft() {
  const group = new THREE.Group();
  const grey = 0x8d99a3;
  const dark = 0x2b2f33;
  const accent = 0xc94f38;

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.7, 13, 12), mat(grey));
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.5;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 10), mat(grey));
  nose.scale.set(1, 0.92, 1.25);
  nose.position.z = -6.2;
  group.add(nose);
  const cockpitGlass = box(2.6, 1.1, 2.2, 0x1d2b33, 0, 1.15, -5.6);
  group.add(cockpitGlass);
  const canopy = cockpitGlass;
  const tailRamp = box(3.2, 2.2, 2.6, grey, 0, 0.7, 7.2);
  tailRamp.rotation.x = 0.35;
  group.add(tailRamp);

  const wing = box(23, 0.5, 3.4, grey, 0, 2.05, -1.2);
  group.add(wing);
  const wingTipL = box(2.2, 0.55, 3.4, accent, -11.2, 2.05, -1.2);
  const wingTipR = box(2.2, 0.55, 3.4, accent, 11.2, 2.05, -1.2);
  group.add(wingTipL, wingTipR);

  const props = [];
  const propDiscs = [];
  for (const x of [-8.4, -4.2, 4.2, 8.4]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.75, 4.4, 10), mat(grey));
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(x, 1.55, -2.2);
    group.add(nacelle);
    const prop = new THREE.Group();
    const bladeA = box(0.22, 3.6, 0.08, dark, 0, 0, 0);
    const bladeB = box(3.6, 0.22, 0.08, dark, 0, 0, 0);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(dark));
    prop.add(bladeA, bladeB, hub);
    prop.position.set(x, 1.55, -4.55);
    group.add(prop);
    props.push(prop);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    disc.position.set(x, 1.55, -4.5);
    group.add(disc);
    propDiscs.push(disc);
  }

  const fin = box(0.4, 4.2, 2.6, grey, 0, 3.4, 6.6);
  const tailplane = box(9.5, 0.35, 2.2, grey, 0, 5.3, 6.8);
  group.add(fin, tailplane);

  const gunL = new THREE.Group();
  const gunR = new THREE.Group();
  for (const [gun, side] of [[gunL, -1], [gunR, 1]]) {
    const housing = box(0.7, 0.9, 3.2, dark, side * 2.05, -0.3, 1.8);
    const barrelA = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), mat(dark));
    barrelA.rotation.z = Math.PI / 2;
    barrelA.position.set(side * 3.4, -0.15, 1.2);
    const barrelB = barrelA.clone();
    barrelB.position.set(side * 3.4, -0.5, 2.4);
    gun.add(housing, barrelA, barrelB);
    group.add(gun);
  }

  const flarePodL = box(1.6, 0.5, 2.4, dark, -6.2, 1.5, -0.6);
  const flarePodR = box(1.6, 0.5, 2.4, dark, 6.2, 1.5, -0.6);
  group.add(flarePodL, flarePodR);

  const gearL = box(1.1, 1.6, 4.6, grey, -2.1, -1.9, 0.6);
  const gearR = box(1.1, 1.6, 4.6, grey, 2.1, -1.9, 0.6);
  group.add(gearL, gearR);

  const aileronL = box(4.4, 0.18, 1.1, 0x6e7a83, -8.8, 2.0, 0.35);
  const aileronR = box(4.4, 0.18, 1.1, 0x6e7a83, 8.8, 2.0, 0.35);
  group.add(aileronL, aileronR);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  blob.rotation.x = -Math.PI / 2;

  return { group, props, propDiscs, aileronL, aileronR, blob, canopy, wing, gunL, gunR };
}
