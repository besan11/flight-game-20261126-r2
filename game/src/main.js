// MERPATI — Island Airmail: boot, render loop and the state machine
// (title → flying → debrief). All game logic lives in the other modules;
// this file wires them together and owns the camera.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildTerrain, groundHeight } from './terrain.js';
import { Sky } from './sky.js';
import { Aircraft } from './aircraft.js';
import { Mission, SORTIES, buildMissionProps, updateMissionProps } from './missions.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { windAt } from './weather.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

class Game {
  constructor() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Filmic tone mapping: the low-poly flat style reads cheap with the
    // default linear output; ACES roll-off keeps the bold colours bold.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87bfe8);
    // Fog colour matches the background exactly: the cheapest cinematic
    // depth trick — the horizon dissolves into the sky instead of a band.
    this.scene.fog = new THREE.Fog(0x87bfe8, 900, 4200);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
    this.camera.position.set(0, 80, 200);

    this.terrain = buildTerrain(this.scene);
    this.sky = new Sky(this.scene);
    this.plane = new Aircraft(this.scene);
    this.hud = new HUD();
    this.input = new Input();
    this.audio = new AudioEngine();

    this.sortieIndex = 0;
    this.mission = null;
    this.missionProps = null;
    this.state = 'title'; // title | flying | debrief
    this.time = 0;
    this.cameraMode = 0; // 0 chase, 1 near
    this.camPos = new THREE.Vector3(0, 80, 200);
    this.crashed = false;
    this.crashTimer = 0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.getElementById('btn-fly').addEventListener('click', () => this.beginFlying());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' && this.state === 'title') this.beginFlying();
      if (event.code === 'Enter' && this.state === 'debrief') this.nextSortie();
      if (event.code === 'KeyR' && this.state !== 'title') this.startSortie(this.sortieIndex);
      if (event.code === 'KeyC') this.cameraMode = 1 - this.cameraMode;
      if (event.code === 'KeyM') this.audio.toggleMute();
    });
  }

  /** (Re)start a sortie: fresh plane, mission, props and lighting. */
  startSortie(index) {
    this.sortieIndex = index;
    const def = SORTIES[index];
    if (this.missionProps) {
      this.scene.remove(this.missionProps);
      this.missionProps = null;
    }
    this.mission = new Mission(index);
    this.missionProps = buildMissionProps(this.scene, this.mission);
    const start = def.start;
    const y = groundHeight(start.x, start.z) + 1.6;
    this.plane.reset(start.x, y, start.z, start.heading);
    this.plane.fuel = def.fuel;
    this.sky.setNight(def.night);
    this.state = 'title';
    this.crashed = false;
    this.hud.hideDebrief();
    this.hud.showTitle(index, def);
    // Put the camera behind the parked plane for the title backdrop.
    const fwd = this.plane.forwardVector();
    this.camPos.copy(this.plane.pos).addScaledVector(fwd, -30).add(new THREE.Vector3(0, 10, 0));
  }

  beginFlying() {
    this.audio.ensure();
    this.state = 'flying';
    this.hud.hideTitle();
    this.mission.showMessage(this.mission.def.windNote, 4);
  }

  nextSortie() {
    const next = (this.sortieIndex + 1) % SORTIES.length;
    this.startSortie(next);
  }

  /** One fixed simulation step, driven by keys or by the screenshot autopilot. */
  stepGame(dt, axes) {
    this.time += dt;
    if (this.state === 'title') this.titleTime = (this.titleTime || 0) + dt;
    else this.titleTime = 0;
    const wind = windAt(this.plane.pos.x, this.plane.pos.y, this.plane.pos.z, this.time, this.sortieIndex);
    if (this.state === 'flying' && !this.crashed) {
      const events = this.plane.step(dt, axes, this.time, this.sortieIndex);
      this.audio.update(this.plane.throttle, this.plane.speed, this.plane.stalled);
      if (events.touchedDown) {
        const result = this.mission.onTouchdown(this.plane, this.plane.verticalSpeed, this.audio);
        if (result && result.grade === 'CRASH' && this.plane.damage >= 100) this.crash();
      }
      if (events.crashed) this.crash();
      this.mission.update(dt, this.plane, this.audio);
      if (this.mission.finished || this.mission.failed) {
        this.state = 'debrief';
        this.hud.showDebrief(this.mission, this.plane);
      }
    }
    this.sky.update(dt, this.time);
    updateMissionProps(this.missionProps, this.time);
    // Lighthouse beam sweeps at night.
    if (this.terrain.lighthouse) {
      const beam = this.terrain.lighthouse.getObjectByName('lighthouseBeam');
      if (beam) beam.rotation.y = this.time * 0.4;
      const lamp = this.terrain.lighthouse.getObjectByName('lighthouseLamp');
      if (lamp) lamp.material.color.setHex(Math.sin(this.time * 3) > 0 ? 0xffe9a3 : 0x8a7a4a);
    }
    this.hud.update(this.plane, this.mission, wind, this.time);
    this.updateCamera(dt);
  }

  crash() {
    this.crashed = true;
    this.crashTimer = 1.2;
    this.mission.failed = true;
    this.mission.failReason = 'The plane went down. The mail is lost.';
  }

  /** Chase camera: a character, not a tripod. It eases toward its slot
   * (easeOutCubic on the approach, never a stiff linear lerp), holds the
   * plane in the lower third with leading space ahead of the nose, and
   * widens its field of view a touch as speed builds. */
  updateCamera(dt) {
    const fwd = this.plane.forwardVector();
    // Title push-in: the camera dollies 30 → 23 over the first 4 s of the
    // title screen, easeInOutCubic, so the title frame has a reason to move.
    const titleT = this.state === 'title' ? Math.min(1, (this.titleTime || 0) / 4) : 1;
    const pushIn = 1 - (titleT < 0.5 ? 4 * titleT ** 3 : 1 - (-2 * titleT + 2) ** 3 / 2);
    const targetDist = this.state === 'title'
      ? 23 + 7 * pushIn
      : this.cameraMode === 0 ? CONFIG.camDistance : 14;
    const targetHeight = this.state === 'title' ? 8 : this.cameraMode === 0 ? CONFIG.camHeight : 4;
    // Camera distance itself eases between modes instead of snapping.
    if (this.camDist === undefined) {
      this.camDist = targetDist;
      this.camHeight = targetHeight;
    }
    const ease = 1 - Math.pow(1 - 0.12, dt * 60); // frame-rate independent ease
    this.camDist += (targetDist - this.camDist) * ease;
    this.camHeight += (targetHeight - this.camHeight) * ease;
    const wanted = this.plane.pos.clone().addScaledVector(fwd, -this.camDist).add(new THREE.Vector3(0, this.camHeight, 0));
    // Keep the camera out of the ground and the sea.
    const ground = groundHeight(wanted.x, wanted.z);
    wanted.y = Math.max(wanted.y, ground + 4);
    wanted.y = Math.max(wanted.y, 3);
    // Ease-out approach: fast when far away, gentle as it settles.
    const k = 1 - Math.exp(-CONFIG.camSmoothing * dt);
    this.camPos.lerp(wanted, k);
    this.camera.position.copy(this.camPos);
    // Leading space: look well ahead of the nose and a touch above the
    // plane, so the aircraft sits in the lower third of the frame with
    // open sky and terrain ahead of it.
    const look = this.plane.pos.clone().addScaledVector(fwd, 48).add(new THREE.Vector3(0, 5, 0));
    this.camera.lookAt(look);
    // Speed kick: the view widens slightly at full throttle, eased.
    const targetFov = 62 + (this.plane.speed / CONFIG.maxSpeed) * 9;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * ease;
      this.camera.updateProjectionMatrix();
    }
  }

  frame(dt) {
    const axes = this.input.controlAxes();
    this.stepGame(dt, axes);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
window.__game = game; // for scripted play-testing
game.startSortie(0);

if (shotName) {
  // Deterministic screenshot mode: stage the shot, render once, and tell
  // the capture script the frame is ready.
  const screen = stageShot(game, shotName);
  game.state = screen === 'title' ? 'title' : 'flying';
  game.renderer.render(game.scene, game.camera);
  window.__shotReady = true;
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
