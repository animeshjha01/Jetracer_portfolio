/**
 * HUD — the telemetry overlay that tracks the car during the drive-by.
 */

import { gsap } from 'gsap';

/** Full sweep of the speedometer arc, in stroke-dash units (see main.css). */
const ARC_LENGTH = 242;
/** Dial maxes out at 36 km/h so the 30 km/h cruise sits at ~83% of the sweep. */
const DIAL_MAX_KMH = 36;

export interface Hud {
  show(): void;
  hide(): void;
  setSpeed(kilometresPerHour: number): void;
}

export function createHud(): Hud {
  const root = document.getElementById('hud');
  const arc = document.getElementById('speedArc');
  const value = document.getElementById('speedVal');

  let lastRendered = -1;

  return {
    show(): void {
      if (root) gsap.to(root, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    },

    hide(): void {
      if (root) gsap.to(root, { opacity: 0, duration: 0.4, ease: 'power2.in' });
    },

    setSpeed(kilometresPerHour: number): void {
      const rounded = Math.round(kilometresPerHour);
      // The readout only changes on whole km/h — skip the DOM write otherwise
      if (rounded === lastRendered) return;
      lastRendered = rounded;

      if (value) value.textContent = String(rounded);
      if (arc) {
        const ratio = Math.min(kilometresPerHour / DIAL_MAX_KMH, 1);
        arc.setAttribute('stroke-dashoffset', String(ARC_LENGTH * (1 - ratio)));
      }
    },
  };
}
