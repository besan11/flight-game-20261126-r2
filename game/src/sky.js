// Sky, sun, clouds and sea: one low-poly style, day and night variants.
import * as THREE from 'three';
import { COLOURS } from './config.js';

/** Big inverted sphere with a vertical gradient, day or night palette. */
function makeSkyDome(night) {
  const top = new THREE.Color(night ? 0x050914 : 0x3f8fd2);
  const mid = new THREE.Color(night ? 0x0b1026 : 0x87bfe8);
  const bottom = new THREE.Color(night ? 0x1a2438 : 0xcfe8f5);
  const geo = new THREE.SphereGeometry(4800, 24, 16);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 4800;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(bottom, 1 - (y + 0.1) / 0.35);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  return dome;
}

/** A cloud is a cluster of flattened white blobs that drifts with the wind. */
function makeCloud(seed) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const puffs = 4 + (seed % 3);
  for (let i = 0; i < puffs; i += 1) {
    const r = 14 + ((seed * 7 + i * 13) % 18);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
    puff.position.set((i - puffs / 2) * 18 + ((seed + i) % 5) * 3, ((seed * 3 + i) % 6) - 3, ((seed * 11 + i * 5) % 10) - 5);
    puff.scale.y = 0.45;
    group.add(puff);
  }
  return group;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.night = false;
    this.domeDay = makeSkyDome(false);
    this.domeNight = makeSkyDome(true);
    this.domeNight.visible = false;
    scene.add(this.domeDay);
    scene.add(this.domeNight);

    // Sun: a bright disc plus the directional light that lights the world.
    this.sunLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
    this.sunLight.position.set(1200, 1500, 600);
    scene.add(this.sunLight);
    this.sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(140, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }),
    );
    this.sunMesh.position.set(2600, 1700, 1300);
    this.sunMesh.lookAt(0, 0, 0);
    scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(90, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }),
    );
    this.moonMesh.position.set(-2200, 1900, -1500);
    this.moonMesh.lookAt(0, 0, 0);
    this.moonMesh.visible = false;
    scene.add(this.moonMesh);
    this.ambient = new THREE.AmbientLight(0xbfd9ee, 0.75);
    scene.add(this.ambient);
    this.hemisphere = new THREE.HemisphereLight(0x9fc8ee, 0x2e6b4f, 0.5);
    scene.add(this.hemisphere);

    // Sea: one big plane, gently animated by scaling its normal shimmer.
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(11000, 11000, 1, 1),
      new THREE.MeshLambertMaterial({ color: COLOURS.seaDay, transparent: true, opacity: 0.94 }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = 0;
    scene.add(this.sea);

    // Clouds at three heights, drifting slowly east.
    this.clouds = [];
    const spots = [
      [-900, 420, -600], [700, 380, 300], [1600, 460, -1200], [-1600, 400, 1200],
      [200, 500, 1500], [-400, 360, -1600], [2200, 420, 600], [0, 440, -2000],
    ];
    spots.forEach(([x, y, z], i) => {
      const cloud = makeCloud(i * 3 + 1);
      cloud.position.set(x, y, z);
      scene.add(cloud);
      this.clouds.push(cloud);
    });

    // Stars for the night sortie, hidden by day.
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i += 1) {
      const a = (i * 2.399) % (Math.PI * 2);
      const e = 0.25 + ((i * 0.731) % 1.2);
      const r = 4400;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
    this.stars.visible = false;
    scene.add(this.stars);
  }

  /** Switch the whole scene between the day and night palettes. */
  setNight(night) {
    this.night = night;
    this.domeDay.visible = !night;
    this.domeNight.visible = night;
    this.sunMesh.visible = !night;
    this.moonMesh.visible = night;
    this.stars.visible = night;
    this.sunLight.intensity = night ? 0.25 : 1.6;
    this.sunLight.color.setHex(night ? 0x8fa8d8 : 0xfff2d0);
    this.ambient.intensity = night ? 0.25 : 0.75;
    this.hemisphere.intensity = night ? 0.15 : 0.5;
    this.sea.material.color.setHex(night ? COLOURS.seaNight : COLOURS.seaDay);
    this.scene.fog = new THREE.Fog(night ? 0x0b1026 : 0x87bfe8, 900, 4200);
    this.scene.background = new THREE.Color(night ? COLOURS.skyNight : COLOURS.skyDay);
  }

  /** Drift clouds and shimmer the sea. */
  update(dt, time) {
    for (let i = 0; i < this.clouds.length; i += 1) {
      const cloud = this.clouds[i];
      cloud.position.x += dt * (2 + i * 0.4);
      if (cloud.position.x > 2600) cloud.position.x = -2600;
    }
    this.sea.material.color.offsetHSL(0, 0, Math.sin(time * 0.5) * 0.008);
  }
}
