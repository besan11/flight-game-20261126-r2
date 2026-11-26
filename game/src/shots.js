// Deterministic screenshot scenes behind ?shot=title|play|landing|night.
// Each one plays the real game forward from a fresh sortie for a fixed
// number of steps, steered by a simple autopilot (throttle up, pitch to
// hold altitude, bank toward the next target), so every frame is a real
// render of the live game and the same seed always gives the same frame.
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
 * Stage a named shot on a fresh game and return the screen the game should
 * show. title: parked on the runway with the title overlay. play: mid-flight
 * chase view with a ring ahead. landing: on final approach to Api Strip.
 * night: the night sortie, mid-flight under the lighthouse beam.
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
  if (name === 'play') {
    game.startSortie(0);
    game.state = 'flying';
    game.hud.hideTitle();
    for (let i = 0; i < 60 * 18; i += 1) game.stepGame(dt, autopilotAxes(game, dt));
    return 'flying';
  }
  // title: idling on the runway, camera looking over the islands.
  game.startSortie(0);
  game.state = 'title';
  game.hud.showTitle(0, SORTIES[0]);
  for (let i = 0; i < 60 * 2; i += 1) game.stepGame(dt, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: true });
  return 'title';
}
