// A vintage gull-wing monoplane built from primitives, with moving control surfaces.
import * as THREE from 'three';

function box(w, h, d, mat, x, y, z, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.z = rz;
  return m;
}

export function buildAircraft() {
  const group = new THREE.Group();
  const pearl = new THREE.MeshLambertMaterial({ color: 0xf3ead8 });
  const vermilion = new THREE.MeshLambertMaterial({ color: 0xc8402a });
  const teal = new THREE.MeshLambertMaterial({ color: 0x2e6f6a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2b30 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.75 });

  // Teardrop fuselage: rounded cowling, tapered tail.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.16, 6.4, 12), pearl);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.6, 1.1, 12), vermilion);
  cowling.rotation.x = Math.PI / 2;
  cowling.position.z = -3.2;
  group.add(cowling);
  const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), dark);
  spinner.position.z = -3.85;
  group.add(spinner);

  // Open cockpit with rim, seat back, and windscreen.
  const canopy = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12), dark);
  tub.position.set(0, 0.52, 0.5);
  const seat = box(0.5, 0.5, 0.14, teal, 0, 0.62, 0.85);
  const screen = box(0.62, 0.42, 0.05, glass, 0, 0.72, 0.05);
  screen.rotation.x = -0.35;
  const headrest = box(0.3, 0.34, 0.16, vermilion, 0, 0.7, 1.05);
  canopy.add(tub, seat, screen, headrest);
  group.add(canopy);

  // Inverted gull wing: inner panels angle down, outer panels rise.
  const wing = new THREE.Group();
  for (const s of [-1, 1]) {
    wing.add(box(2.4, 0.13, 1.6, pearl, s * 1.2, -0.42, -0.8, s * -0.16));
    wing.add(box(3.4, 0.12, 1.35, pearl, s * 3.9, -0.28, -0.8, s * 0.1));
    wing.add(box(0.5, 0.14, 1.35, vermilion, s * 5.5, -0.1, -0.8, s * 0.1));
  }
  group.add(wing);

  const aileronGeo = new THREE.BoxGeometry(2.4, 0.08, 0.5);
  const aileronL = new THREE.Mesh(aileronGeo, teal);
  aileronL.position.set(-4.1, -0.24, 0.05);
  const aileronR = new THREE.Mesh(aileronGeo, teal);
  aileronR.position.set(4.1, -0.24, 0.05);
  group.add(aileronL, aileronR);

  // Rounded tail feathers.
  const tailWing = box(3.6, 0.1, 0.95, vermilion, 0, 0.18, 2.95);
  const fin = box(0.1, 1.25, 1.05, vermilion, 0, 0.72, 2.95);
  const finTop = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), vermilion);
  finTop.scale.set(0.12, 0.6, 1);
  finTop.position.set(0, 1.3, 2.95);
  group.add(tailWing, fin, finTop);

  // Two-blade wooden propeller on the longitudinal axis, with a blur disc at speed.
  const prop = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.1, 0.06), dark);
  blade.rotation.z = 0.5;
  const bladeTipA = box(0.26, 0.3, 0.07, vermilion, 0, 1.42, 0);
  const bladeTipB = box(0.26, 0.3, 0.07, vermilion, 0, -1.42, 0);
  const spinnerCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dark);
  prop.add(blade, bladeTipA, bladeTipB, spinnerCap);
  prop.position.z = -3.95;
  group.add(prop);
  const propDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.58, 28),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  propDisc.position.z = -3.93;
  group.add(propDisc);

  // Fixed gear with teardrop wheel spats and a tail skid.
  const spatGeo = new THREE.SphereGeometry(0.5, 10, 8);
  for (const sx of [-1.25, 1.25]) {
    const leg = box(0.12, 0.85, 0.12, dark, sx, -0.75, -1.1);
    const spat = new THREE.Mesh(spatGeo, vermilion);
    spat.scale.set(0.42, 0.85, 1.5);
    spat.position.set(sx, -1.15, -1.1);
    group.add(leg, spat);
  }
  group.add(box(0.08, 0.5, 0.08, dark, 0, -0.35, 3.1));

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  blob.rotation.x = -Math.PI / 2;

  return { group, prop, propDisc, aileronL, aileronR, blob, canopy, wing };
}
