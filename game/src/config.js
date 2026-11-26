// MERPATI — Island Airmail: every tuning number lives here so the flight
// model, missions and HUD all agree on one set of constants.
export const CONFIG = {
  // Flight model
  maxSpeed: 95, // m/s at full throttle, level flight
  cruiseSpeed: 62,
  stallSpeed: 26, // below this the wing stops flying
  minFlySpeed: 18,
  throttleAccel: 0.55, // throttle 0..1 moves toward target this fast
  drag: 0.012,
  pitchRate: 0.55, // rad/s at full elevator
  rollRate: 1.35, // rad/s at full aileron
  maxRoll: 1.1,
  maxPitch: 0.55,
  turnFactor: 0.55, // heading rate per radian of bank
  rudderRate: 0.25,
  climbEfficiency: 0.9,
  sinkRateStalled: 14, // m/s extra sink when stalled
  gravity: 9.8,

  // Fuel and damage
  fuelCapacity: 100,
  fuelBurnFull: 1.35, // fuel units per second at full throttle
  fuelBurnIdle: 0.25,
  damageHardLanding: 34, // damage points for a hard touchdown
  damageCrash: 100,

  // World
  seaLevel: 0,
  worldRadius: 2600, // playable radius; beyond this the wind pushes you back
  ceiling: 620, // soft ceiling in metres

  // Landing grading
  runwayLength: 260,
  runwayWidth: 26,
  goodVs: 2.5, // vertical speed m/s for an A-grade touchdown
  okVs: 5.0,
  goodSpeed: 55,
  maxLandingSpeed: 78,

  // Scoring
  parcelPoints: 150,
  ringPoints: 100,
  landingA: 400,
  landingB: 250,
  landingC: 120,
  timeBonusPerSecond: 2,

  // Camera
  camDistance: 22,
  camHeight: 6,
  camSmoothing: 4.5,
};

export const COLOURS = {
  skyDay: 0x87bfe8,
  skyNight: 0x0b1026,
  seaDay: 0x1f7fa8,
  seaNight: 0x0a1e33,
  sand: 0xe8d49a,
  grass: 0x5da24a,
  jungle: 0x2f7a33,
  rock: 0x8a7f74,
  volcano: 0x5a4a42,
  lava: 0xff5a1f,
  planeCream: 0xf2ead8,
  planeRed: 0xc0392b,
  planeTeal: 0x1f7a6d,
  runway: 0x3a3f46,
  ring: 0xffc93c,
};
