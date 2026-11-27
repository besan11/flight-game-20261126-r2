// The three sorties of the airmail campaign: waypoints, mail parcels,
// rings to fly through, landing grading and scoring.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { AIRSTRIPS, groundHeight } from './terrain.js';

export const SORTIES = [
  {
    name: 'Sortie 1 — Morning Post',
    brief: 'Daylight pickup from Merpati Field. Drop mail at Api Strip, then Kelapa Strip. Gentle breeze, full tank.',
    night: false,
    fuel: 100,
    // Parked on the Merpati Field runway threshold, pointing down the strip.
    start: { x: 91, z: 5, heading: 0.35 },
    parcels: [
      { x: 480, y: 120, z: -420, taken: false, label: 'MAIL BAG 1' },
      { x: 1150, y: 200, z: -300, taken: false, label: 'MAIL BAG 2' },
    ],
    rings: [
      { x: 980, y: 90, z: -560, r: 42, passed: false, label: 'GOLD RING' },
    ],
    landAt: 1, // Api Strip
    landThen: 2, // then Kelapa Strip
    windNote: 'Wind 4 m/s from the east',
  },
  {
    name: 'Sortie 2 — Night Mail',
    brief: 'Night run to Kelapa Strip under the lighthouse beam. Gusts off the sea — watch the windsock, keep the speed up.',
    night: true,
    fuel: 85,
    start: { x: 91, z: 5, heading: 0.35 },
    parcels: [
      { x: -500, y: 150, z: 300, taken: false, label: 'NIGHT BAG 1' },
      { x: -900, y: 110, z: 700, taken: false, label: 'NIGHT BAG 2' },
    ],
    rings: [
      { x: -1150, y: 80, z: 640, r: 42, passed: false, label: 'GOLD RING' },
    ],
    landAt: 2,
    landThen: null,
    windNote: 'Wind 11 m/s, gusting to 18',
  },
  {
    name: 'Sortie 3 — Long Haul',
    brief: 'The long haul: Api, then Kelapa, then home to Merpati Field. Tight fuel and a crosswind on every landing. No second chances.',
    night: false,
    fuel: 70,
    start: { x: 91, z: 5, heading: 0.35 },
    parcels: [
      { x: 700, y: 180, z: -900, taken: false, label: 'HAUL BAG 1' },
      { x: -200, y: 160, z: 900, taken: false, label: 'HAUL BAG 2' },
    ],
    rings: [
      { x: 980, y: 90, z: -560, r: 42, passed: false, label: 'GOLD RING' },
      { x: -1150, y: 80, z: 640, r: 42, passed: false, label: 'GOLD RING' },
    ],
    landAt: 1,
    landThen: 2,
    landThenHome: true,
    windNote: 'Wind 15 m/s crosswind',
  },
];

/** Grade a touchdown: zone, vertical speed and approach speed all count. */
export function gradeLanding(strip, plane, verticalSpeed) {
  const dx = plane.pos.x - strip.x;
  const dz = plane.pos.z - strip.z;
  // Same runway axis as terrain.js: (-sin h, -cos h).
  const along = Math.abs(dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading));
  const across = Math.abs(dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading));
  const inZone = along < CONFIG.runwayLength / 2 && across < CONFIG.runwayWidth / 2;
  const vs = Math.abs(verticalSpeed);
  const speedOk = plane.speed < CONFIG.maxLandingSpeed;
  if (!inZone || !speedOk || vs > CONFIG.okVs) {
    return { grade: 'CRASH', points: 0, reason: !inZone ? 'off the runway' : vs > CONFIG.okVs ? 'too hard' : 'too fast' };
  }
  if (vs <= CONFIG.goodVs && plane.speed <= CONFIG.goodSpeed) {
    return { grade: 'A', points: CONFIG.landingA, reason: 'smooth as silk' };
  }
  if (vs <= CONFIG.okVs) {
    return { grade: 'B', points: CONFIG.landingB, reason: 'a firm arrival' };
  }
  return { grade: 'C', points: CONFIG.landingC, reason: 'a bumpy one' };
}

export class Mission {
  constructor(sortieIndex) {
    this.sortieIndex = sortieIndex;
    this.def = SORTIES[sortieIndex];
    this.parcels = this.def.parcels.map((p) => ({ ...p }));
    this.rings = this.def.rings.map((r) => ({ ...r }));
    this.landings = [];
    this.score = 0;
    this.parcelsCollected = 0;
    this.ringsPassed = 0;
    this.time = 0;
    this.landingTargets = [this.def.landAt];
    if (this.def.landThen !== null && this.def.landThen !== undefined) this.landingTargets.push(this.def.landThen);
    if (this.def.landThenHome) this.landingTargets.push(0);
    this.currentLanding = 0;
    this.finished = false;
    this.failed = false;
    this.failReason = '';
    this.message = '';
    this.messageUntil = 0;
  }

  /** The strip the pilot must land on next, or null when done. */
  nextStrip() {
    if (this.currentLanding >= this.landingTargets.length) return null;
    return AIRSTRIPS[this.landingTargets[this.currentLanding]];
  }

  /** The current objective: next parcel, ring, or landing strip. */
  nextTarget() {
    const parcel = this.parcels.find((p) => !p.taken);
    if (parcel) return { kind: 'parcel', ...parcel };
    const ring = this.rings.find((r) => !r.passed);
    if (ring) return { kind: 'ring', ...ring };
    const strip = this.nextStrip();
    if (strip) return { kind: 'land', x: strip.x, y: strip.elev + 30, z: strip.z, name: strip.name };
    return null;
  }

  /** Distance and bearing (degrees) from the plane to the current target. */
  targetInfo(plane) {
    const t = this.nextTarget();
    if (!t) return null;
    const dx = t.x - plane.pos.x;
    const dz = t.z - plane.pos.z;
    const dist = Math.hypot(dx, dz);
    const bearing = ((Math.atan2(-dx, -dz) * 180) / Math.PI + 360) % 360;
    return { kind: t.kind, name: t.label || t.name || 'TARGET', dist, bearing, y: t.y };
  }

  showMessage(text, duration = 3) {
    this.message = text;
    this.messageUntil = this.time + duration;
  }

  /** Per-frame mission logic: pickups, rings, fuel and completion. */
  update(dt, plane, audio) {
    this.time += dt;
    for (const parcel of this.parcels) {
      if (parcel.taken) continue;
      const d = Math.hypot(plane.pos.x - parcel.x, plane.pos.y - parcel.y, plane.pos.z - parcel.z);
      if (d < 26) {
        parcel.taken = true;
        this.parcelsCollected += 1;
        this.score += CONFIG.parcelPoints;
        this.showMessage(`Mail collected! +${CONFIG.parcelPoints}`);
        if (audio) audio.chime(false);
      }
    }
    for (const ring of this.rings) {
      if (ring.passed) continue;
      const d = Math.hypot(plane.pos.x - ring.x, plane.pos.y - ring.y, plane.pos.z - ring.z);
      if (d < ring.r) {
        ring.passed = true;
        this.ringsPassed += 1;
        this.score += CONFIG.ringPoints;
        this.showMessage(`Ring! +${CONFIG.ringPoints}`);
        if (audio) audio.chime(true);
      }
    }
    if (plane.fuel <= 0 && !plane.onGround) {
      this.failed = true;
      this.failReason = 'Out of fuel — the mail goes down with the plane.';
    }
    if (plane.damage >= 100) {
      this.failed = true;
      this.failReason = 'The plane is wrecked. The mail is lost.';
    }
    if (this.currentLanding >= this.landingTargets.length && this.parcels.every((p) => p.taken)) {
      this.finished = true;
    }
  }

  /** Called on touchdown: grade it against the current target strip. */
  onTouchdown(plane, verticalSpeed, audio) {
    const strip = this.nextStrip();
    if (!strip) return null;
    const result = gradeLanding(strip, plane, verticalSpeed);
    if (result.grade === 'CRASH') {
      plane.damage += CONFIG.damageHardLanding;
      this.showMessage(`Hard landing — ${result.reason}! Damage +${CONFIG.damageHardLanding}`, 4);
      if (audio) audio.thud(true);
      if (plane.damage >= 100) {
        this.failed = true;
        this.failReason = `Crashed ${result.reason} at ${strip.name}.`;
      }
      return result;
    }
    this.score += result.points;
    this.landings.push({ strip: strip.name, grade: result.grade, points: result.points });
    this.currentLanding += 1;
    this.showMessage(`Landed at ${strip.name} — grade ${result.grade}, ${result.reason}. +${result.points}`, 4);
    if (audio) audio.thud(false);
    if (this.currentLanding >= this.landingTargets.length && this.parcels.every((p) => p.taken)) {
      this.finished = true;
      const timeBonus = Math.max(0, Math.round(600 - this.time) * CONFIG.timeBonusPerSecond);
      this.score += timeBonus;
      this.timeBonus = timeBonus;
    }
    return result;
  }

  /** Final grade from the whole sortie. */
  finalGrade() {
    const grades = this.landings.map((l) => l.grade);
    if (this.failed) return 'F';
    if (grades.includes('A') && !grades.includes('C') && this.parcelsCollected === this.parcels.length) return 'A';
    if (grades.includes('A') || grades.includes('B')) return 'B';
    return 'C';
  }
}

/** Ring meshes and parcel meshes for a mission, rebuilt per sortie. */
export function buildMissionProps(scene, mission) {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ringEdges = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
  for (const ring of mission.rings) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(ring.r, 1.6, 8, 32), ringMat);
    torus.position.set(ring.x, ring.y, ring.z);
    torus.userData.ring = ring;
    group.add(torus);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(ring.r - 2, 0.5, 6, 32), ringEdges);
    inner.position.copy(torus.position);
    inner.userData.ring = ring;
    group.add(inner);
  }
  const parcelMat = new THREE.MeshLambertMaterial({ color: 0xd9a441 });
  const parcelTape = new THREE.MeshLambertMaterial({ color: 0x8a5a1e });
  for (const parcel of mission.parcels) {
    const box = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 5), parcelMat);
    box.add(body);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.5, 1.2), parcelTape);
    box.add(tape);
    box.position.set(parcel.x, parcel.y, parcel.z);
    box.userData.parcel = parcel;
    group.add(box);
  }
  scene.add(group);
  return group;
}

/** Hide collected parcels and passed rings; bob the rest gently. */
export function updateMissionProps(group, time) {
  for (const child of group.children) {
    if (child.userData.parcel) {
      child.visible = !child.userData.parcel.taken;
      child.rotation.y = time * 0.8;
      child.position.y += Math.sin(time * 2 + child.position.x) * 0.008;
    }
    if (child.userData.ring) {
      child.visible = !child.userData.ring.passed;
      child.rotation.z = time * 0.3;
    }
  }
}

/** Compass arrow: which way to turn to reach a bearing, in -180..180. */
export function relativeBearing(headingDeg, bearingDeg) {
  let d = bearingDeg - headingDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export { groundHeight };
