# JET RACER

An immersive, scroll-driven showcase for **Resource-Optimized Vehicle-to-Vehicle (V2V)
Autonomous Swarm Coordination** — two NVIDIA Jetson Nano powered JetRacer modules
coordinating collision avoidance over a Tailscale UDP bridge.

Built with **TypeScript + Vite**, **Three.js** for the 3D vehicle and **GSAP /
ScrollTrigger** for the choreography.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
npm run typecheck  # tsc --noEmit
```

## The experience

| # | Section | What happens |
|---|---------|--------------|
| 1 | **Boot gate** | Scroll is locked behind a glowing red ignition button. |
| 2 | **Drive-by** | Pressing START fires a shockwave, then the JetRacer drives in from off-frame left, through the middle and out off-frame right at **30 km/h** — shot from a locked-off camera that never moves. |
| 3 | **Title** | Scroll unlocks and auto-advances; `JET RACER` flies in one glyph at a time over a slowly rotating 3D car. |
| 4 | **Pixel reveal** | A photograph of the module resolves block by block, tied to scroll position. |
| 5–8 | **Content** | Spec bento, software pipeline, the V2V network bridge, the 4GB bottleneck and the hardcoded evasion sequence. |
| 9–10 | **Field docs** | Photo gallery with parallax, plus the two recorded runs, which play on screen and pause off it. |

## Layout

```
index.html                     Page markup and content
public/media/                  Photographs and run footage
src/
  main.ts                      Orchestration: boot gate → drive-by → scroll handoff
  scene/
    jetracer.ts                THE VEHICLE — procedural Three.js model
    stage.ts                   Renderer, camera rig, lighting, ground, render loop
  sequence/
    driveBy.ts                 The locked-off 30 km/h pass and the idle turntable
    pixelReveal.ts             Scroll-driven block-by-block image resolve
  ui/
    hud.ts                     Speedometer and telemetry chips
    scrollAnimations.ts        Reveals, counters, bars, hero entrance, video decks
  styles/main.css              Design tokens and all section styling
```

## The vehicle model

[`src/scene/jetracer.ts`](src/scene/jetracer.ts) builds the robot from scratch in
Three.js — no imported mesh — modelled from the reference photographs in
`resources/`:

- Anodized green aluminium chassis plate and side rails
- Black EVA foam front bumper
- Four blue chrome 10-spoke rims inside knobby tyres
- Black acrylic upper deck on brass hex standoffs
- Rotating 360° LiDAR drum
- Jetson Nano carrier, finned heatsink, I/O stack, GPIO header and status LEDs
- Two raked WiFi antennas, green camera mast with a wide-angle CSI camera
- Two silver Waveshare geared motors with encoder boards

Everything is in **metres** (1 world unit = 1 m), so the physics is honest: the car
integrates position from a real 5.556 m/s velocity, and wheel spin is derived as
`ω = v / r`. The tyres genuinely rotate at the speed the HUD reports.

The camera distance adapts to viewport aspect (`computeFrameDistance`), so the car
frames correctly on a portrait phone as well as a widescreen desktop.

## Design system

Dark carbon and mission-control telemetry. The accent trio is pulled off the
physical robot:

| Token | Value | Role |
|-------|-------|------|
| `--red` | `#EF4444` | Ignition, alerts, the emergency ping |
| `--green` | `#22C55E` | Anodized chassis, active telemetry |
| `--blue` | `#3B82F6` | Chrome wheels, data links |
| `--bg` | `#020617` | Page ground |
| `--panel` | `#0B1022` | Card surfaces |

Type is **Inter** for display and **JetBrains Mono** for technical labels.

## Accessibility and performance

- Full `prefers-reduced-motion` path: the drive-by settles instantly, the pixel
  reveal renders complete, and all scroll choreography is skipped.
- No horizontal overflow at 375 / 768 / 1024 / 1440 px.
- The WebGL render loop parks itself when the stage is transparent or the tab is
  hidden, so the page costs nothing once the intro is over.
- Videos play only while on screen; device pixel ratio is capped at 2; shadows are
  limited to the key light and the hero meshes.
- Three.js and GSAP are split into separate cached chunks.
