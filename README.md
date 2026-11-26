# MERPATI — Island Airmail

![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)
![rank](https://make.fun/badge/best-flight-game-20261126-0057/besan11/flight-game-20261126-r2/rank.svg)
![reward](https://make.fun/badge/best-flight-game-20261126-0057/besan11/flight-game-20261126-r2/reward.svg)

An entry for the [best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057) on make.fun.

Fly Merpati, a little mail plane (merpati means "dove" in Indonesian), on a
three-sortie airmail campaign over a stylised Indonesian archipelago. Pick up
mail bags, thread the gold rings, and put the plane down gently on island
airstrips — while the fuel gauge, the wind and a stalling wing all have their
say.

## The three sorties

1. **Morning Post** — daylight pickup from Merpati Field, deliveries to Api
   Strip and Kelapa Strip. A gentle breeze and a full tank.
2. **Night Mail** — a night run to Kelapa Strip under the lighthouse beam,
   with gusts coming off the sea.
3. **Long Haul** — Api, then Kelapa, then home to Merpati Field. Tight fuel
   and a crosswind on every landing.

## How it flies

- **↑ / ↓** pitch, **← / →** bank and turn, **W / S** throttle, **Q / E**
  rudder, **SPACE** brake, **C** camera, **M** mute, **R** restart.
- Lift comes from airspeed: go slow and the wing stalls, the nose drops and
  the controls go soft. Bank to turn — the heading follows the bank angle.
- Fuel burns with the throttle. Empty means a glider, and a glider over the
  sea is a short story.
- Wind is real: it strengthens with altitude, gusts near the islands and
  across the volcano's lee side, and pushes your ground track. The HUD shows
  its speed and direction.
- Landings are graded: touchdown zone, vertical speed and approach speed
  decide between an A and a wreck. Hard landings add damage; three bad ones
  end the sortie.

## What you see

A low-poly archipelago with a smoking volcano, beaches, palm clusters, a
sweeping lighthouse, a town whose windows light up at night, drifting clouds
and an animated sea — all in one style, day and night. The HUD carries big
high-contrast altitude, airspeed and heading, a compass strip, fuel and
throttle bars, wind, score and a waypoint arrow. Sounds are synthesised
live with WebAudio: engine hum, wind rush and chimes. No audio files, no
network requests — everything the game loads is a file under `game/`.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static server. The game is plain files
under `game/` with no build step; Three.js is vendored at
`game/vendor/three.module.min.js`.

## Layout

- `game/src/main.js` — boot, render loop, title → flying → debrief
- `game/src/aircraft.js` — the Merpati mesh and the flight model
- `game/src/terrain.js` — archipelago heightfield, islands, props, airstrips
- `game/src/sky.js` — sky dome, sun, moon, clouds, sea, day/night palettes
- `game/src/missions.js` — sorties, parcels, rings, landing grading, scoring
- `game/src/hud.js` — HUD, title and debrief overlays
- `game/src/weather.js` — wind shear and gusts
- `game/src/input.js` — keyboard and mouse input
- `game/src/audio.js` — WebAudio synth sounds
- `game/src/config.js` — every tuning number
- `game/src/shots.js` — deterministic screenshot states (`?shot=title|play|landing|night`)
- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json`

## License

MIT — see `LICENSE`.
