/**
 * COMET CARD
 *
 * A vanilla-TS port of Aceternity UI's Comet Card, driven by GSAP instead of
 * Framer Motion — this project has no React runtime, so the original component
 * could not be dropped in as-is. The behaviour it reproduces:
 *
 *   · the card tilts in 3D toward the pointer, with a slight lift and scale;
 *   · a soft glare tracks the pointer across the surface;
 *   · a bright "comet" spark chases the pointer, easing in more slowly than the
 *     glare so it reads as a head with a trailing tail;
 *   · the border warms up while the pointer is inside.
 *
 * Applied to `[data-comet]` — the gallery photographs, the spec tiles, the
 * evasion cards and the hero image.
 *
 * Pointer position is published as CSS custom properties (`--mx` / `--my`) so
 * the paint side lives entirely in CSS; only the transform is animated in JS.
 */

import { gsap } from 'gsap';

import { prefersReducedMotion } from './scrollAnimations';

/** Peak tilt at the card's corners, in degrees. */
const MAX_DEGREES = 9;
/** How far the card lifts toward the viewer while hovered, in px. */
const LIFT = 26;

function decorate(card: HTMLElement): void {
  // The overlays are decorative and injected rather than authored into the
  // markup, so the HTML stays about content and a card can opt in with one
  // attribute.
  const glare = document.createElement('span');
  glare.className = 'comet__glare';
  glare.setAttribute('aria-hidden', 'true');

  const spark = document.createElement('span');
  spark.className = 'comet__spark';
  spark.setAttribute('aria-hidden', 'true');

  card.append(glare, spark);
}

export function initCometCards(): void {
  const cards = document.querySelectorAll<HTMLElement>('[data-comet]');

  for (const card of cards) {
    card.classList.add('comet');
    decorate(card);
  }

  if (prefersReducedMotion) return;
  // Tilt needs a real pointer. On touch the cards keep their comet styling but
  // stay flat — a tilt that can only be triggered by a tap is just a jitter.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  for (const card of cards) {
    const rotateX = gsap.quickTo(card, 'rotationX', { duration: 0.55, ease: 'power3.out' });
    const rotateY = gsap.quickTo(card, 'rotationY', { duration: 0.55, ease: 'power3.out' });
    const lift = gsap.quickTo(card, 'z', { duration: 0.55, ease: 'power3.out' });
    const scale = gsap.quickTo(card, 'scale', { duration: 0.55, ease: 'power3.out' });

    // The glare snaps to the pointer; the spark lags, which is what gives the
    // comet its tail.
    const glareX = gsap.quickTo(card, '--gx', { duration: 0.18, ease: 'power2.out' });
    const glareY = gsap.quickTo(card, '--gy', { duration: 0.18, ease: 'power2.out' });
    const sparkX = gsap.quickTo(card, '--sx', { duration: 0.72, ease: 'power3.out' });
    const sparkY = gsap.quickTo(card, '--sy', { duration: 0.72, ease: 'power3.out' });

    gsap.set(card, { transformPerspective: 900, transformOrigin: '50% 50%' });

    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      rotateY((px - 0.5) * MAX_DEGREES * 2);
      rotateX(-(py - 0.5) * MAX_DEGREES * 2);

      glareX(px * 100);
      glareY(py * 100);
      sparkX(px * 100);
      sparkY(py * 100);
    });

    card.addEventListener('pointerenter', () => {
      card.classList.add('is-comet-live');
      lift(LIFT);
      scale(1.018);
    });

    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-comet-live');
      rotateX(0);
      rotateY(0);
      lift(0);
      scale(1);
    });
  }
}
