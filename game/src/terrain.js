// The archipelago: an analytic heightfield (islands as smooth bumps, so the
// flight model and the mesh always agree) plus low-poly props — palms, a
// lighthouse, a lit town, a volcano and three airstrips.
import * as THREE from 'three';
import { COLOURS } from './config.js';

// Island bumps: x, z, radius, height. The volcano is the tall one.
export const ISLANDS = [
  { name: 'Pulau Merpati', x: 0, z: 0, r: 620, h: 52 },
  { name: 'Pulau Api', x: 980, z: -760, r: 520, h: 190 },
  { name: 'Pulau Kelapa', x: -1150, z: 850, r: 560, h: 46 },
  { name: 'Pulau Kecil', x: 1500, z: 900, r: 340, h: 30 },
  { name: 'Karang', x: -700, z: -1250, r: 260, h: 22 },
  { name: 'Pulau Senja', x: 350, z: 1650, r: 420, h: 38 },
];

// Airstrips: flat ground, a runway mesh and a windsock. Heading in radians.
export const AIRSTRIPS = [
  { name: 'Merpati Field', island: 0, x: 60, z: -80, heading: 0.35, elev: 14 },
  { name: 'Api Strip', island: 1, x: 980, z: -560, heading: -0.5, elev: 26 },
  { name: 'Kelapa Strip', island: 2, x: -1150, z: 640, heading: 1.1, elev: 12 },
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Small deterministic ripple so the ground is not a perfect cone. */
function ripple(x, z) {
  return Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.7) * 2.2
    + Math.sin((x + z) * 0.004) * 3.0;
}

/**
 * Ground height at (x, z). Runway pads are flattened to their elevation so
 * landings happen on level ground.
 */
export function groundHeight(x, z) {
  let h = -6; // sea floor, well below the water plane
  for (const island of ISLANDS) {
    const d = Math.hypot(x - island.x, z - island.z) / island.r;
    if (d < 1.15) {
      const bump = Math.pow(Math.max(0, 1 - d * d), 1.6);
      h = Math.max(h, island.h * bump + ripple(x, z) * bump);
    }
  }
  for (const strip of AIRSTRIPS) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    // Runway axis is the plane's forward for the strip heading:
    // (-sin h, -cos h). Along/across are measured against that axis.
    const along = Math.abs(dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading));
    const across = Math.abs(dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading));
    if (along < 320 && across < 70) {
      // Flatten well out along the approach so the final is over level
      // ground, not the island's rising slope.
      const pad = smoothstep(320, 200, along) * smoothstep(70, 40, across);
      h = h * (1 - pad) + strip.elev * pad;
    }
  }
  return h;
}

/** Colour for a terrain vertex: sand near the water, grass, then jungle, rock. */
function terrainColour(x, z, h) {
  const c = new THREE.Color();
  if (h < 3) c.setHex(COLOURS.sand);
  else if (h < 22) c.setHex(COLOURS.grass);
  else if (h < 70) c.setHex(COLOURS.jungle);
  else c.setHex(COLOURS.rock);
  // Volcano cone is dark rock with a warm rim near the crater.
  const dx = x - ISLANDS[1].x;
  const dz = z - ISLANDS[1].z;
  const d = Math.hypot(dx, dz);
  if (d < 200 && h > 90) c.setHex(COLOURS.volcano);
  if (d < 70 && h > 150) c.setHex(COLOURS.lava);
  const shade = 0.92 + 0.08 * Math.sin(x * 0.05) * Math.sin(z * 0.05);
  c.multiplyScalar(shade);
  return c;
}

function makePalm() {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b3a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 9, 5), trunkMat);
  trunk.position.y = 4.5;
  trunk.rotation.z = 0.12;
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6.5, 4), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 2.4, 9.2, Math.sin(angle) * 2.4);
    leaf.rotation.set(Math.sin(angle) * 1.1, 0, -Math.cos(angle) * 1.1);
    palm.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a1f }));
  nut.position.y = 8.6;
  palm.add(nut);
  return palm;
}

function makeLighthouse() {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 8),
    new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
  );
  tower.position.y = 13;
  group.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.8, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xc0392b }),
  );
  band.position.y = 16;
  group.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a3 }),
  );
  lamp.position.y = 27.5;
  lamp.name = 'lighthouseLamp';
  group.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 90, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(45, 27.5, 0);
  beam.name = 'lighthouseBeam';
  group.add(beam);
  return group;
}

function makeTown() {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb5502e });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const windows = [];
  for (let i = 0; i < 14; i += 1) {
    const house = new THREE.Group();
    const w = 7 + (i % 3) * 2;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 5, 6), wallMat);
    walls.position.y = 2.5;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, 3.5, 4), roofMat);
    roof.position.y = 6.7;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), windowMat);
    win.position.set(0, 2.6, 3.05);
    house.add(win);
    windows.push(win);
    const angle = (i / 14) * Math.PI * 2;
    const r = 26 + (i % 4) * 9;
    house.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r * 0.8);
    house.rotation.y = angle;
    group.add(house);
  }
  group.userData.windows = windows;
  return group;
}

/** Build the whole terrain group and return it with handles for animation. */
export function buildTerrain(scene) {
  const group = new THREE.Group();
  const size = 5200;
  const segments = 180;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const c = terrainColour(x, z, h);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(ground);

  // Volcano crater glow.
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(46, 12),
    new THREE.MeshBasicMaterial({ color: COLOURS.lava }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(ISLANDS[1].x, groundHeight(ISLANDS[1].x, ISLANDS[1].z) + 1.5, ISLANDS[1].z);
  crater.name = 'craterGlow';
  group.add(crater);

  // Runways: dark strips with white centre dashes and threshold bars.
  const runwayMat = new THREE.MeshLambertMaterial({ color: COLOURS.runway });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const strip of AIRSTRIPS) {
    const pad = new THREE.Group();
    const stripMesh = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 26), runwayMat);
    stripMesh.position.y = 0.6;
    pad.add(stripMesh);
    for (let d = -110; d <= 110; d += 28) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 2), dashMat);
      dash.position.set(d, 1.3, 0);
      pad.add(dash);
    }
    pad.position.set(strip.x, strip.elev, strip.z);
    // Long axis of the strip mesh (+X) must map to the runway axis
    // (-sin h, -cos h): rotation.y = h + PI/2 does exactly that.
    pad.rotation.y = strip.heading + Math.PI / 2;
    group.add(pad);
  }

  // Palm clusters on the beaches of the three inhabited islands.
  const palmSpots = [
    [240, 260], [320, 180], [-180, 300], [150, -380],
    [-950, 1050], [-1350, 700], [-1050, 1150],
    [820, -420], [1250, -900],
  ];
  for (const [x, z] of palmSpots) {
    const palm = makePalm();
    palm.position.set(x, groundHeight(x, z), z);
    palm.rotation.y = (x * 0.7 + z) % 6.28;
    const s = 0.9 + ((x + z) % 7) * 0.04;
    palm.scale.setScalar(Math.max(0.8, s));
    group.add(palm);
  }

  // Lighthouse on the point of Pulau Merpati.
  const lighthouse = makeLighthouse();
  lighthouse.position.set(-420, groundHeight(-420, -260), -260);
  group.add(lighthouse);

  // Town beside Merpati Field, windows glow at night.
  const town = makeTown();
  town.position.set(230, groundHeight(230, 120), 120);
  group.add(town);

  scene.add(group);
  return { group, lighthouse, town, crater };
}
