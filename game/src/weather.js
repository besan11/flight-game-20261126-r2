// Wind shear and gusts. The wind is a function of position and time so the
// same sortie always feels the same, and it grows near islands and at night.
import { CONFIG } from './config.js';

/** Base wind for a sortie: direction in radians, strength in m/s. */
export function baseWind(sortieIndex, time) {
  const bases = [
    { dir: 0.6, speed: 4 }, // sortie 1: light morning breeze
    { dir: 2.4, speed: 11 }, // sortie 2: night gusts from the sea
    { dir: -1.2, speed: 15 }, // sortie 3: strong crosswind
  ];
  const b = bases[Math.min(sortieIndex, bases.length - 1)];
  return { x: Math.cos(b.dir) * b.speed, z: Math.sin(b.dir) * b.speed, time };
}

/** Gusts: smooth pseudo-noise from a few sines, so gusts build and fade. */
export function gustAt(x, z, time, sortieIndex) {
  const strength = sortieIndex === 0 ? 2.5 : sortieIndex === 1 ? 6 : 8;
  const g =
    Math.sin(time * 0.7 + x * 0.004) * 0.6 +
    Math.sin(time * 1.3 + z * 0.006 + 1.7) * 0.3 +
    Math.sin(time * 0.23 + (x + z) * 0.0015) * 0.5;
  return g * strength;
}

/**
 * Wind vector at a point. Shear: wind strengthens with altitude and near the
 * volcano island, and gusts push mostly across the runway axis.
 */
export function windAt(x, y, z, time, sortieIndex) {
  const base = baseWind(sortieIndex, time);
  const altitudeFactor = 0.5 + Math.min(1, y / CONFIG.ceiling);
  const gust = gustAt(x, z, time, sortieIndex);
  // Volcano island sits near (900, -700): its lee side is turbulent.
  const dx = x - 900;
  const dz = z + 700;
  const lee = Math.max(0, 1 - Math.hypot(dx, dz) / 500);
  const shear = 1 + lee * 0.9;
  return {
    x: (base.x * altitudeFactor + gust * 0.7) * shear,
    z: (base.z * altitudeFactor + gust * 0.5) * shear,
    gust,
    speed: Math.hypot(base.x, base.z) * altitudeFactor + Math.abs(gust),
  };
}

/** Compass direction (degrees, 0 = north = -Z) of a wind vector. */
export function windHeading(wind) {
  const deg = (Math.atan2(wind.x, -wind.z) * 180) / Math.PI;
  return (deg + 360) % 360;
}
