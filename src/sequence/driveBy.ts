/**
 * DRIVE-BY — the JetRacer crosses a locked-off frame at 30 km/h.
 *
 * The camera does not move. It is planted at the centre of the shot for the
 * whole pass, and the car drives in from off-frame left, through the middle, and
 * out off-frame right on its own.
 *
 * On the speed: 30 km/h is the telemetry reading, not the world translation.
 * This is a 1:10 scale model, so a literal 8.33 m/s across a frame that spans
 * roughly 0.9 metres of world would cross it in about 0.13 s — one blurred
 * frame, gone before it registers. Instead the pass is timed (`PASS_DURATION`)
 * and the world velocity is solved backwards from it. What still holds:
 *
 *   · the wheels are driven from the *actual* ground velocity, so they never
 *     slip against the grid — which now matters, because the grid is static and
 *     any mismatch would be visible;
 *   · the readout, the ramp and the wheel spin all rise and settle together, so
 *     the car and the dial always agree with each other.
 */

import * as THREE from 'three';
import {
  CAMERA_TARGET_Y,
  CAMERA_HEIGHT,
  computeFrameDistance,
  computeFrameHalfWidth,
  frameHalfWidthAt,
  type Stage,
} from '../scene/stage';
import type { Hud } from '../ui/hud';

/** The number on the dial, and in the status line. */
export const CRUISE_SPEED_KMH = 30;
/** 30 km/h in metres per second — kept for callers that want the stated speed. */
export const CRUISE_SPEED_MPS = CRUISE_SPEED_KMH / 3.6;

/**
 * How long the car takes to cross, entry to exit. This is the value the pass is
 * actually built on — see the note on speed above.
 */
const PASS_DURATION = 1.35;
const ACCEL_DURATION = 0.28;
/**
 * Clearance kept between the car's centre and the frame edge at the extremes of
 * the pass. It has to clear the car's own half-length, or the tail is still on
 * screen when the run is declared over — generous here, because the car sits at
 * z = 0 while the frame width is measured at the camera's working distance.
 */
const FRAME_MARGIN = 0.34;

/** Widest half-frame the motes need to cover, across every viewport shape. */
const FIELD_HALF_WIDTH = 1.2;

/** Glowing motes scattered through the volume, for depth behind the pass. */
function createSpeedField(): THREE.Points {
  const count = 220;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2 * FIELD_HALF_WIDTH;
    positions[i * 3 + 1] = 0.02 + Math.random() * 0.55;
    // Kept off the driving line so the motes read as depth, not debris
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x3b8ef0,
    size: 0.014,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export interface DriveByOptions {
  stage: Stage;
  hud: Hud;
  /** Status line under the car, e.g. "CRUISE · 30 KM/H". */
  statusEl: HTMLElement | null;
  /** Skip the animation and settle immediately (reduced motion). */
  instant?: boolean;
}

/** X the car exits at, for the current viewport shape. Recomputed per frame so
 *  a resize mid-pass cannot strand the car inside the frame. */
function exitX(aspect: number): number {
  return computeFrameHalfWidth(aspect) + FRAME_MARGIN;
}

/** Plants the camera dead centre. The whole pass is shot from this one spot. */
function lockCamera(camera: THREE.PerspectiveCamera): void {
  camera.position.set(0, CAMERA_HEIGHT, computeFrameDistance(camera.aspect));
  camera.lookAt(0, CAMERA_TARGET_Y, 0);
}

/** Runs the pass. Resolves once the car has left frame. */
export function runDriveBy(options: DriveByOptions): Promise<void> {
  const { stage, hud, statusEl, instant } = options;
  const { racer, camera } = stage;

  const speedField = createSpeedField();
  stage.scene.add(speedField);

  lockCamera(camera);
  racer.group.position.set(-exitX(camera.aspect), 0, 0);
  racer.group.rotation.y = 0;

  hud.show();

  if (instant) {
    racer.group.position.x = 0;
    lockCamera(camera);
    hud.setSpeed(CRUISE_SPEED_KMH);
    if (statusEl) statusEl.textContent = `RUN COMPLETE · ${CRUISE_SPEED_KMH} KM/H`;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let carX = racer.group.position.x;
    let speed = 0;
    let elapsed = 0;
    let finished = false;
    let lastStatus = '';

    /**
     * Cruise velocity that lands the crossing on PASS_DURATION. An easeOutCubic
     * ramp covers 3/4 of the ground a constant velocity would over the same
     * window, so the ramp is worth ACCEL_DURATION/4 of lost distance.
     */
    const span = 2 * exitX(camera.aspect);
    const cruise = span / (PASS_DURATION - ACCEL_DURATION / 4);

    const setStatus = (text: string): void => {
      if (statusEl && text !== lastStatus) {
        statusEl.textContent = text;
        lastStatus = text;
      }
    };

    stage.onFrame((delta) => {
      if (finished) return;
      elapsed += delta;

      // Ramp to cruise, then hold. easeOutCubic so the launch has weight.
      if (elapsed < ACCEL_DURATION) {
        const p = elapsed / ACCEL_DURATION;
        speed = cruise * (1 - Math.pow(1 - p, 3));
      } else {
        speed = cruise;
      }

      carX += speed * delta;
      racer.group.position.x = carX;

      // Dead straight. The old sine-wave steering correction read as a wobble
      // once the camera stopped moving with the car.
      racer.setSteer(0);
      racer.group.rotation.y = 0;
      // Wheels from the true ground velocity, so nothing slips against the now
      // static grid; suspension from how hard the car is being driven, which at
      // this scale is not the same number.
      racer.update(delta, speed, speed / cruise);

      // The camera stays put. Re-locking each frame costs nothing and keeps the
      // framing correct if the viewport is resized mid-pass.
      lockCamera(camera);

      // The dial reports the stated speed, ramped in step with the car.
      const ratio = speed / cruise;
      hud.setSpeed(CRUISE_SPEED_KMH * ratio);

      const end = exitX(camera.aspect);
      const progress = THREE.MathUtils.clamp((carX + end) / (2 * end), 0, 1);

      if (ratio < 0.98) setStatus('MOTORS ENGAGED · SPOOLING');
      else if (progress < 0.9) setStatus(`CRUISE · ${CRUISE_SPEED_KMH} KM/H · KCF ACTIVE`);
      else setStatus('RUN COMPLETE');

      if (carX >= end) {
        finished = true;
        hud.hide();
        resolve();
      }
    });
  });
}

/** Extra distance at rest, so the whole car reads rather than filling the frame. */
const IDLE_PULLBACK = 0.28;
/** Where the car parks, as a fraction of the half-frame. 0 is centre, 1 the edge. */
const IDLE_X_FRACTION = 0.46;
/** Below this aspect the two-column title layout stacks, and so does the car. */
const STACK_ASPECT = 1.1;
/** Turntable rate, radians per second. */
const IDLE_SPIN = 0.42;

/**
 * Parks the car and turns it on the spot, for the title section.
 *
 * On a wide viewport the title copy sits in the left column and the car parks in
 * the right one, so this pushes it off-centre in world space to line up with
 * that empty column. Narrow viewports stack instead: the copy goes to the top
 * and the car drops to the centre-bottom, which is what the raised `lookAt`
 * target does.
 *
 * The camera itself never moves.
 *
 * Returns a per-frame updater the caller drives.
 */
export function createIdlePose(stage: Stage): (delta: number) => void {
  const { racer, camera } = stage;
  let t = 0;

  racer.setSteer(0);

  return (delta: number): void => {
    t += delta;

    const stacked = camera.aspect < STACK_ASPECT;
    const distance = computeFrameDistance(camera.aspect) + IDLE_PULLBACK;

    // Still camera. The drive-by locked it off; there is no reason for it to
    // start drifting the moment the car stops.
    camera.position.set(0, CAMERA_HEIGHT + 0.09, distance);
    camera.lookAt(0, CAMERA_TARGET_Y + (stacked ? 0.1 : 0), 0);

    // Park in the right-hand column, beside the copy — or dead centre when the
    // layout has stacked and there is no column to sit in.
    const offset = stacked
      ? 0
      : frameHalfWidthAt(distance, camera.aspect) * IDLE_X_FRACTION;
    racer.group.position.set(offset, 0, 0);

    // Turntable, so the chrome and the anodizing catch the lights
    racer.group.rotation.y = t * IDLE_SPIN;
    racer.update(delta, 0);
  };
}
