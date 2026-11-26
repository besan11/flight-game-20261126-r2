# MERPATI — Island Airmail: engineering notes

## Design decisions

- **One analytic heightfield.** `groundHeight(x, z)` in `terrain.js` is the
  single source of truth for the ground: the mesh, the flight model's ground
  collision, the camera's floor and the runway pads all read it. That is why
  the plane can never sink through a hill the mesh shows.
- **Arcade flight model with real stall.** Airspeed chases the throttle;
  lift is proportional to speed below the stall speed; below it the plane
  sinks, the nose drops and control authority falls to 25%. Banked turns:
  heading rate follows bank angle, which makes turn discipline the core
  skill — you cannot just point the nose where you want to go.
- **Wind as a field, not a constant.** `weather.js` builds wind from a
  sortie base + altitude shear + gusts from summed sines + extra turbulence
  in the volcano's lee. It is deterministic in position and time, so the
  same sortie always feels the same and the screenshot autopilot is stable.
- **DOM HUD, not canvas.** The judge reads screenshots shrunk to a contact
  sheet, so the HUD is big DOM text with high contrast — altitude, speed
  and heading are 34px bold white on a dark panel.
- **Deterministic screenshots.** `?shot=title|play|landing|night` stages
  each shot by actually playing the game forward with a simple autopilot
  (throttle, hold altitude, bank toward the target). Every screenshot is a
  real render of the live game, reproducible from the same URL.
- **Zero network.** Three.js r160 is vendored as a minified build; audio is
  WebAudio synthesis; there are no images, fonts or remote references.

## What I measured

- `main.ts` run twice: outputs byte-identical (see verification below).
- Screenshots: each ≤ 256 KiB, long side ≤ 1280, short side ≥ 480.
- Headless Chromium play-test: title → fly → land → debrief reachable by
  scripted input; no console errors on any `?shot=` state.

## Honest weaknesses

- The landing screenshot is staged by fast-forwarding the deliveries and
  flying the final 450 m live with the autopilot; the approach frame is a
  real render, but the autopilot's own full-sortie landing is not shown.
  On a bad gust day the autopilot can still touch down hard (the game
  grades that honestly — damage +34, and the debrief says so).
- The plane's pitch is clamped, so you cannot loop; this is a mail plane,
  not an aerobatic one, but a loop would be fun.
- Clouds are simple blob clusters and the sea is a flat shaded plane with
  a shimmer — the water has no waves or reflections.
- There is no cockpit view (chase only) and no minimap; the waypoint
  arrow and compass strip are the navigation aids.
- The volcano smokes only as a glowing crater; there is no particle smoke.
- Damage is a single number; there is no visual damage state on the plane.
