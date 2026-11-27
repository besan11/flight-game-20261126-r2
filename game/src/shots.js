// Deterministic screenshot scenes behind ?shot=title|play|landing|night|cover.
// Each one plays the real game forward from a fresh sortie for a fixed
// number of steps, steered by a simple autopilot (throttle up, pitch to
// hold altitude, bank toward the next target), so every frame is a real
// render of the live game and the same seed always gives the same frame.
// The cover and play shots are staged like landing: the plane is placed
// on the ring leg and the sim flies the last 1.5 s live, bank held at
// 30-40 degrees, so the nose sweeps onto the gold ring as the chase
// camera settles.
import * as THREE from 'three';
import { SORTIES } from './missions.js';

/** Steer toward the current target: full throttle, hold altitude, bank in.
 * Throttle is a lever, not a target: the autopilot pushes it up or down
 * until it sits where the leg wants it. */
export function autopilotAxes(game, dt) {
  const plane = game.plane;
  const mission = game.mission;
  const target = mission.nextTarget();
  // Desired lever position for this leg: full power en route, back on final.
  let wantThrottle = 1;
  if (target && target.kind === 'land') {
    const d = Math.hypot(target.x - plane.pos.x, target.z - plane.pos.z);
    // Power back on final — but never below a safe margin over the stall.
    if (d < 600) wantThrottle = 0.45;
  }
  const axes = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false };
  if (wantThrottle > plane.throttle + 0.05) axes.throttle = 1;
  else if (wantThrottle < plane.throttle - 0.05) axes.throttle = -1;
  if (!target) {
    axes.throttle = 0.4;
    return axes;
  }
  const dx = target.x - plane.pos.x;
  const dz = target.z - plane.pos.z;
  const bearing = Math.atan2(-dx, -dz);
  let rel = bearing - plane.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  axes.roll = Math.max(-0.65, Math.min(0.65, rel * 1.0));
  // Hold altitude: pitch toward the target's height, level off near it.
  const targetY = target.kind === 'land' ? 60 : target.y;
  const dy = targetY - plane.pos.y;
  axes.pitch = Math.max(-1, Math.min(1, dy * 0.02 - plane.pitch * 0.5));
  if (target.kind === 'land' && Math.hypot(dx, dz) < 600) {
    // Final approach: gentle descent, power back, aim for the numbers.
    axes.pitch = Math.max(-0.25, Math.min(0.1, (target.y - plane.pos.y) * 0.005 - plane.pitch * 0.3));
  }
  return axes;
}

/**
 * Hold a steady banked turn: roll is driven toward a fixed bank angle
 * with a proportional controller (not a rate command), so the bank sits
 * at 30-40 degrees instead of saturating at the flight model's 63-degree
 * roll clamp the way the free-flight autopilot does — that saturated bank
 * is what made the old play shot read as an imminent crash. Throttle is
 * held at cruise (~55 m/s) so the turn rate stays put, and pitch holds
 * altitude. The turn rate follows the bank, so over the 1.5 s hold the
 * nose sweeps about 0.57 rad onto the target.
 */
export function holdBankAxes(game, targetBank, targetY) {
  const plane = game.plane;
  const axes = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false };
  // Cruise throttle: hold speed near 55 m/s so the turn rate stays put.
  const wantThrottle = 55 / 95;
  if (wantThrottle > plane.throttle + 0.05) axes.throttle = 1;
  else if (wantThrottle < plane.throttle - 0.05) axes.throttle = -1;
  // Proportional roll hold: bank at the target, no overshoot past it.
  axes.roll = Math.max(-1, Math.min(1, (targetBank - plane.roll) * 3));
  // Hold altitude: pitch toward the target height, level off near it.
  axes.pitch = Math.max(-1, Math.min(1, (targetY - plane.pos.y) * 0.02 - plane.pitch * 0.5));
  return axes;
}

/**
 * Stage a composed banked-turn frame on the ring leg: the first parcel is
 * already aboard (score 150, waypoint GOLD RING), the plane is placed on
 * the ring approach with its nose aimed off the ring by exactly the sweep
 * of the hold, and the sim flies the last 1.5 s live — bank held, altitude
 * held — so the nose sweeps onto the ring as the chase camera settles.
 * The camera is snapped to its chase slot before the hold so it tracks
 * from the right place instead of chasing across the map from the title
 * camera. `bank` > 0 is a left bank, < 0 a right bank.
 */
function stagedBankShot(game, { x, y, z, heading, bank }) {
  const dt = 1 / 60;
  game.startSortie(0);
  game.state = 'flying';
  game.hud.hideTitle();
  // Both parcels aboard (score 300): the gold ring is the live waypoint,
  // so the HUD pill reads GOLD RING instead of the next mail bag.
  for (const p of game.mission.parcels) {
    if (!p.taken) {
      p.taken = true;
      game.mission.parcelsCollected += 1;
      game.mission.score += 150;
    }
  }
  const plane = game.plane;
  plane.pos.set(x, y, z);
  plane.heading = heading;
  plane.pitch = 0;
  plane.roll = bank;
  plane.speed = 55;
  plane.throttle = 55 / 95;
  plane.fuel = 100;
  plane.onGround = false;
  // Snap the chase camera to its slot behind the placed plane.
  const fwd = plane.forwardVector();
  game.camPos.copy(plane.pos).addScaledVector(fwd, -22).add(new THREE.Vector3(0, 6, 0));
  game.camDist = 22;
  game.camHeight = 6;
  for (let i = 0; i < 60 * 1.5; i += 1) {
    game.stepGame(dt, holdBankAxes(game, bank, y));
    if (game.state !== 'flying') break;
  }
  return 'flying';
}

/**
 * Stage a named shot on a fresh game and return the screen the game should
 * show. title: parked on the runway with the title overlay. cover: chase
 * view mid-turn toward the gold ring over Api, volcano behind it. play:
 * chase view mid-turn toward the gold ring from the east, over the sea.
 * landing: on final approach to Api Strip. night: the night sortie,
 * mid-flight under the lighthouse beam.
 */
export function stageShot(game, name) {
  const dt = 1 / 60;
  if (name === 'night') {
    game.startSortie(1);
    game.state = 'flying';
    game.hud.hideTitle();
    for (let i = 0; i < 60 * 14; i += 1) game.stepGame(dt, autopilotAxes(game, dt));
    return 'flying';
  }
  if (name === 'landing') {
    game.startSortie(0);
    game.state = 'flying';
    game.hud.hideTitle();
    // Stage the final approach and fly it in for real: the deliveries are
    // fast-forwarded (the mail is aboard, the ring is flown), the tank is
    // topped up, and the autopilot flies the last 500 m to Api Strip live.
    for (const p of game.mission.parcels) {
      if (!p.taken) {
        p.taken = true;
        game.mission.parcelsCollected += 1;
        game.mission.score += 150;
      }
    }
    for (const r of game.mission.rings) {
      if (!r.passed) {
        r.passed = true;
        game.mission.ringsPassed += 1;
        game.mission.score += 100;
      }
    }
    const strip = game.mission.nextStrip();
    const fx = -Math.sin(strip.heading);
    const fz = -Math.cos(strip.heading);
    game.plane.pos.set(strip.x - fx * 450, strip.elev + 100, strip.z - fz * 450);
    game.plane.heading = strip.heading;
    game.plane.pitch = -0.1;
    game.plane.roll = 0;
    game.plane.speed = 55;
    game.plane.throttle = 0.45;
    game.plane.fuel = 70;
    game.plane.onGround = false;
    for (let i = 0; i < 60 * 7; i += 1) {
      game.stepGame(dt, autopilotAxes(game, dt));
      if (game.state !== 'flying') break;
    }
    return 'flying';
  }
  if (name === 'cover') {
    // Money shot: south-west of the ring and high (260 m), looking
    // north-east down the flattened runway corridor at it, with the
    // volcano cone sitting below the plane behind it, Api Strip below it
    // and open sea on both sides — the cone reads as a backdrop, not a
    // wall. Ring at (980, 90, -560); from (600, 260, -20) its bearing
    // is -0.61 rad. Left bank +0.6 rad (34 degrees) sweeps the nose
    // +0.57 rad over the 1.5 s hold, so start aimed -1.19 and arrive on it.
    return stagedBankShot(game, { x: 600, y: 260, z: -20, heading: -1.19, bank: 0.6 });
  }
  if (name === 'play') {
    // Same ring leg, tighter and lower (180 m, ~370 m out): the gold
    // ring is big in frame with the runway below it, the volcano behind
    // it, the plane threading it in a 34-degree bank. (The south-east
    // approach was tried and rejected: the volcano ridge hides all but
    // an arc of the ring from that side.) Ring bearing from
    // (760, 180, -260) is -0.63 rad; left bank +0.6 rad sweeps +0.57 rad
    // over the hold, so start at -1.20 and arrive on it.
    return stagedBankShot(game, { x: 760, y: 180, z: -260, heading: -1.20, bank: 0.6 });
  }
  // title: idling on the runway, camera looking over the islands.
  game.startSortie(0);
  game.state = 'title';
  game.hud.showTitle(0, SORTIES[0]);
  for (let i = 0; i < 60 * 2; i += 1) game.stepGame(dt, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: true });
  return 'title';
}
