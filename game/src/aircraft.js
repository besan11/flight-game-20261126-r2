// Merpati, the little mail plane: a low-poly build from boxes, cylinders and
// cones, plus the flight model — lift, drag, stall, banked turns, fuel burn.
import * as THREE from 'three';
import { CONFIG, COLOURS } from './config.js';
import { groundHeight } from './terrain.js';
import { windAt } from './weather.js';

/** Build the plane mesh: cream fuselage, red stripe, teal tail, spinning prop. */
export function buildPlaneMesh() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: COLOURS.planeCream });
  const red = new THREE.MeshLambertMaterial({ color: COLOURS.planeRed });
  const teal = new THREE.MeshLambertMaterial({ color: COLOURS.planeTeal });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });

  // Fuselage: a tapered cylinder pointing -Z (the plane flies toward -Z).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 6.4, 8), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.6, 8), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  plane.add(nose);
  // Red cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.34, 5.6), red);
  stripe.position.set(0, 0.1, 0.4);
  plane.add(stripe);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), glass);
  canopy.scale.set(1, 0.75, 1.6);
  canopy.position.set(0, 0.85, -0.9);
  plane.add(canopy);
  // Main wing, low and straight, with red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.2), cream);
  wing.position.set(0, -0.25, -0.4);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 2.2), red);
    tip.position.set(side * 5.4, -0.25, -0.4);
    plane.add(tip);
  }
  // Tail: horizontal stabiliser + tall teal fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.3), cream);
  tailplane.position.set(0, 0.15, 3.2);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.7), teal);
  fin.position.set(0, 1.0, 3.3);
  fin.rotation.x = 0.25;
  plane.add(fin);
  // Mail pod slung under the belly, with a little red cross of parcels.
  const pod = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 2.6), teal);
  pod.position.set(0, -1.05, 0.6);
  plane.add(pod);
  // Propeller: hub + two blades, spun by the flight model.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.12), dark);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  prop.position.z = -4.35;
  plane.add(prop);
  plane.userData.prop = prop;
  // Navigation lights: red left, green right, white tail.
  const navLights = [];
  const lightDefs = [
    [-5.8, -0.25, -0.4, 0xff2222],
    [5.8, -0.25, -0.4, 0x22ff66],
    [0, 0.3, 3.7, 0xffffff],
  ];
  for (const [x, y, z, color] of lightDefs) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color }));
    lamp.position.set(x, y, z);
    plane.add(lamp);
    navLights.push(lamp);
  }
  plane.userData.navLights = navLights;
  return plane;
}

export class Aircraft {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildPlaneMesh();
    scene.add(this.mesh);
    // Contact shadow: a soft blob that grounds the plane when it is low,
    // fading and widening as it climbs, so it never floats over the world.
    this.blobShadow = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.blobShadow.rotation.x = -Math.PI / 2;
    scene.add(this.blobShadow);
    this.squash = 0; // 0..1 landing squash envelope, decays with overshoot
    this.reset(0, 60, 0, 0);
  }

  reset(x, y, z, heading) {
    this.pos = new THREE.Vector3(x, y, z);
    this.heading = heading; // radians, 0 = north (-Z)
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.verticalSpeed = 0;
    this.fuel = CONFIG.fuelCapacity;
    this.damage = 0;
    this.stalled = false;
    this.onGround = true;
    this.propSpin = 0;
  }

  /** Forward unit vector from heading and pitch. */
  forwardVector() {
    return new THREE.Vector3(
      -Math.sin(this.heading) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.heading) * Math.cos(this.pitch),
    );
  }

  /**
   * One physics step. `axes` is { pitch, roll, yaw, throttle, brake } in
   * -1..1. Returns events: { touchedDown, crashed, stalled }.
   */
  step(dt, axes, time, sortieIndex) {
    const events = { touchedDown: false, crashed: false, stalled: false };
    // Throttle lever.
    this.throttle = Math.min(1, Math.max(0, this.throttle + axes.throttle * CONFIG.throttleAccel * dt * 2));
    if (axes.brake) this.throttle = Math.max(0, this.throttle - dt * 1.2);
    // Fuel burn: throttle-heavy, and nothing left means a glider.
    const burn = (CONFIG.fuelBurnIdle + (CONFIG.fuelBurnFull - CONFIG.fuelBurnIdle) * this.throttle) * dt;
    this.fuel = Math.max(0, this.fuel - burn);
    const hasFuel = this.fuel > 0;
    // Airspeed chases the throttle setting; drag grows with speed squared.
    const targetSpeed = hasFuel ? this.throttle * CONFIG.maxSpeed : 0;
    const accel = (targetSpeed - this.speed) * 0.35 - CONFIG.drag * this.speed * this.speed * 0.12;
    this.speed = Math.max(0, this.speed + accel * dt);
    // Controls: weak when slow or stalled, strong at cruise.
    const authority = Math.min(1, Math.max(0.25, this.speed / CONFIG.cruiseSpeed));
    this.stalled = this.speed < CONFIG.stallSpeed && !this.onGround && this.pos.y > groundHeight(this.pos.x, this.pos.z) + 4;
    if (this.stalled) events.stalled = true;
    this.pitch += axes.pitch * CONFIG.pitchRate * authority * dt * (this.stalled ? 0.4 : 1);
    this.pitch = Math.min(CONFIG.maxPitch, Math.max(-CONFIG.maxPitch, this.pitch));
    this.roll += axes.roll * CONFIG.rollRate * authority * dt;
    this.roll = Math.min(CONFIG.maxRoll, Math.max(-CONFIG.maxRoll, this.roll));
    // Banked turn: heading follows the bank — bank left, turn left.
    // (roll > 0 is a left bank, so heading grows with a left bank.)
    this.heading += this.roll * CONFIG.turnFactor * (this.speed / CONFIG.maxSpeed) * dt * 2;
    this.heading += axes.yaw * CONFIG.rudderRate * authority * dt;
    // Roll settles back toward level when the stick is centred.
    if (axes.roll === 0) this.roll *= Math.max(0, 1 - dt * 0.9);
    // Climb: lift from speed and pitch; stall sinks, hard.
    const lift = Math.min(1, this.speed / CONFIG.stallSpeed);
    let climb = Math.sin(this.pitch) * this.speed * CONFIG.climbEfficiency * lift;
    if (this.stalled) climb -= CONFIG.sinkRateStalled * (1 - lift);
    if (this.onGround && this.speed < CONFIG.stallSpeed) climb = 0;
    this.verticalSpeed = climb;
    // Wind pushes the ground track.
    const wind = windAt(this.pos.x, this.pos.y, this.pos.z, time, sortieIndex);
    const fwd = this.forwardVector();
    this.pos.x += (fwd.x * this.speed + wind.x * 0.35) * dt;
    this.pos.y += climb * dt;
    this.pos.z += (fwd.z * this.speed + wind.z * 0.35) * dt;
    // Soft ceiling and world edge.
    if (this.pos.y > CONFIG.ceiling) {
      this.pos.y = CONFIG.ceiling;
      this.pitch = Math.min(this.pitch, 0);
    }
    const dist = Math.hypot(this.pos.x, this.pos.z);
    if (dist > CONFIG.worldRadius) {
      const push = (dist - CONFIG.worldRadius) / 200;
      this.pos.x -= (this.pos.x / dist) * push * dt * 20;
      this.pos.z -= (this.pos.z / dist) * push * dt * 20;
    }
    // Ground contact: landing or crash, judged by the caller from vertical speed.
    const ground = groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= ground + 1.6) {
      this.pos.y = ground + 1.6;
      if (!this.onGround) {
        events.touchedDown = true;
        this.onGround = true;
        // Squash: the plane sits down into its gear on touchdown, then
        // settles back with a small overshoot (easeOutBack-style recovery).
        this.squash = 1;
      }
      // Rolling on the ground: friction and no climb.
      this.speed = Math.max(0, this.speed - dt * 14);
      this.pitch = 0;
      this.roll *= Math.max(0, 1 - dt * 3);
    } else {
      this.onGround = false;
    }
    // Sea is fatal at speed, a ditching at low speed.
    if (this.pos.y < 2.5 && ground < 1 && !this.onGround) {
      events.crashed = true;
    }
    this.updateMesh(dt, time);
    return events;
  }

  updateMesh(dt, time) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateY(this.heading);
    // Anticipation: on the takeoff roll the nose lifts a touch before the
    // wing has enough speed to fly — the plane tells you it is about to go.
    let pitchOffset = 0;
    if (this.onGround && this.throttle > 0.6 && this.speed < CONFIG.stallSpeed) {
      pitchOffset = 0.06 * (this.throttle - 0.6) * 2.5;
    }
    this.mesh.rotateX(this.pitch + pitchOffset);
    this.mesh.rotateZ(this.roll);
    // Landing squash with volume preservation: squash Y by s, widen X/Z
    // by 1/sqrt(s), then settle back with a small easeOutBack overshoot.
    this.squash = Math.max(0, this.squash - dt * 2.2);
    const s = this.squash;
    const sy = 1 - 0.16 * s + 0.05 * Math.sin(s * Math.PI);
    const sxz = 1 / Math.sqrt(sy);
    // Idle breath: parked and idling, the plane is never a frozen statue.
    const breath = this.onGround && this.throttle < 0.1 ? 1 + 0.008 * Math.sin(time * 2.1) : 1;
    this.mesh.scale.set(sxz * breath, sy * breath, sxz * breath);
    // Blob contact shadow: strong and tight on the ground, faint and wide up high.
    const ground = groundHeight(this.pos.x, this.pos.z);
    const heightAbove = Math.max(0, this.pos.y - ground);
    const shadowStrength = Math.max(0, 1 - heightAbove / 140);
    this.blobShadow.position.set(this.pos.x, ground + 0.4, this.pos.z);
    this.blobShadow.material.opacity = 0.4 * shadowStrength;
    const shadowScale = 1 + heightAbove * 0.012;
    this.blobShadow.scale.setScalar(shadowScale);
    this.blobShadow.visible = shadowStrength > 0.02;
    // Propeller spins with throttle; nav lights blink.
    this.propSpin += dt * (4 + this.throttle * 60);
    this.mesh.userData.prop.rotation.z = this.propSpin;
    const blink = Math.sin(time * 4) > 0;
    for (const lamp of this.mesh.userData.navLights) lamp.visible = blink || lamp.material.color.getHex() !== 0xffffff;
  }

  /** Heading in degrees, 0 = north, for the HUD compass. */
  headingDegrees() {
    return ((this.heading * 180) / Math.PI % 360 + 360) % 360;
  }

  altitudeFeet() {
    return Math.max(0, this.pos.y) * 3.28084;
  }

  speedKnots() {
    return this.speed * 1.94384;
  }
}
