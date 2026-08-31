/**
 * INTRO CHOREOGRAPHY
 *
 * Every beat of the opening, expressed as GSAP timelines:
 *
 *   `playBootEntrance()`  — the gate assembles itself: grid floor, eyebrow,
 *                           ignition button, hint, footer.
 *   `playIgnition()`      — the press: punch, shockwave, flash, gate clears.
 *
 * Both resolve when the timeline finishes, so `main.ts` can await them and keep
 * the sequence readable top to bottom. Under `prefers-reduced-motion` each one
 * snaps to its end state and resolves immediately.
 */

import { gsap } from 'gsap';

import { prefersReducedMotion } from '../ui/scrollAnimations';

/* -------------------------------------------------------------------------- */
/* Boot gate entrance                                                         */
/* -------------------------------------------------------------------------- */

/** Assembles the boot gate. Runs the moment the page is ready. */
export function playBootEntrance(): gsap.core.Timeline | null {
  const boot = document.getElementById('boot');
  if (!boot) return null;

  const grid = boot.querySelector('.boot__grid');
  const eyebrow = boot.querySelector('.boot__eyebrow');
  const button = boot.querySelector('#startBtn');
  const halo = boot.querySelector('.ignite__halo');
  const ring = boot.querySelector('.ignite__ring');
  const hint = boot.querySelector('.boot__hint');
  const foot = boot.querySelectorAll('.boot__foot span');

  if (prefersReducedMotion) {
    gsap.set([grid, eyebrow, button, halo, ring, hint, ...foot], { opacity: 1, y: 0, scale: 1 });
    return null;
  }

  const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  timeline
    // The floor arrives first — it establishes the horizon everything else sits on
    .fromTo(grid, { opacity: 0, scaleY: 0.4 }, { opacity: 0.75, scaleY: 1, duration: 1.1 })
    .fromTo(eyebrow, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.6 }, 0.25)
    // The button lands hard, then the bloom and containment ring catch up
    .fromTo(
      button,
      { opacity: 0, scale: 0.6, rotate: -12 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: 'back.out(1.5)' },
      0.35,
    )
    .fromTo(halo, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.8 }, 0.7)
    .fromTo(ring, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.7 }, 0.7)
    .fromTo(hint, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55 }, 0.9)
    .fromTo(foot, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 1);

  return timeline;
}

/* -------------------------------------------------------------------------- */
/* Ignition                                                                   */
/* -------------------------------------------------------------------------- */

/** Expanding rings from the button, as if the press discharged something. */
function emitShockwave(origin: { x: number; y: number }): void {
  if (prefersReducedMotion) return;

  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('span');
    ring.className = 'shockwave';
    ring.style.left = `${origin.x}px`;
    ring.style.top = `${origin.y}px`;
    ring.style.width = '160px';
    ring.style.height = '160px';
    document.body.appendChild(ring);

    gsap.fromTo(
      ring,
      { scale: 0.35, opacity: 0.85 },
      {
        scale: 7 + i * 2.4,
        opacity: 0,
        duration: 1.15 + i * 0.22,
        delay: i * 0.1,
        ease: 'expo.out',
        onComplete: () => ring.remove(),
      },
    );
  }
}

function flashScreen(): void {
  const flash = document.getElementById('flash');
  if (!flash || prefersReducedMotion) return;
  gsap.fromTo(
    flash,
    { opacity: 0.9 },
    { opacity: 0, duration: 0.55, ease: 'power2.out' },
  );
}

/**
 * Plays the press: the button punches in, discharges, and the gate clears the
 * screen. Resolves once the gate is gone and the drive-by can take over.
 */
export function playIgnition(startBtn: HTMLElement, boot: HTMLElement): Promise<void> {
  const rect = startBtn.getBoundingClientRect();
  emitShockwave({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  flashScreen();

  if (prefersReducedMotion) {
    gsap.set(boot, { display: 'none' });
    return Promise.resolve();
  }

  const timeline = gsap.timeline();

  timeline
    .to(startBtn, { scale: 0.88, duration: 0.12, ease: 'power2.in' })
    .to(startBtn, { scale: 1.35, opacity: 0, duration: 0.45, ease: 'power3.out' })
    // The surrounding copy leaves ahead of the backdrop so the gate empties out
    // rather than simply dimming
    .to('.boot__eyebrow, .boot__hint, .boot__foot', {
      opacity: 0,
      y: -10,
      duration: 0.3,
      ease: 'power2.in',
    }, '-=0.4')
    .to(boot, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, '-=0.25')
    .set(boot, { display: 'none' });

  return timeline.then().then(() => undefined);
}
