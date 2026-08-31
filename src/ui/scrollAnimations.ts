/**
 * SCROLL CHOREOGRAPHY
 *
 * Every scroll-linked behaviour on the page: section reveals, the kinetic
 * wordmark, counting statistics, meter bars, card tilt and the video decks.
 *
 * All of it is a no-op under `prefers-reduced-motion`, where the CSS already
 * pins `[data-reveal]` to its resting state.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

/* -------------------------------------------------------------------------- */
/* Section reveals                                                            */
/* -------------------------------------------------------------------------- */

export function initReveals(): void {
  if (prefersReducedMotion) return;

  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 26 },
      {
        opacity: 1,
        y: 0,
        duration: 0.66,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          // Replay on the way back up, but never re-run mid-scroll jitter
          toggleActions: 'play none none reverse',
        },
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Kinetic wordmark                                                           */
/* -------------------------------------------------------------------------- */

/** Flies the JET RACER characters in. Called once the intro hands over. */
export function playWordmark(): void {
  const chars = document.querySelectorAll<HTMLElement>('#wordmark .ch');
  if (chars.length === 0) return;

  if (prefersReducedMotion) {
    gsap.set(chars, { opacity: 1, y: 0, rotateX: 0 });
    return;
  }

  gsap.fromTo(
    chars,
    { opacity: 0, yPercent: 118, rotateX: -78, filter: 'blur(14px)' },
    {
      opacity: 1,
      yPercent: 0,
      rotateX: 0,
      filter: 'blur(0px)',
      duration: 1.05,
      ease: 'expo.out',
      stagger: 0.052,
    },
  );
}

/** Parks the wordmark off-stage until `playWordmark` runs. */
export function primeWordmark(): void {
  if (prefersReducedMotion) return;
  gsap.set('#wordmark .ch', { opacity: 0, yPercent: 118, rotateX: -78 });
  gsap.set('#wordmark', { perspective: 900 });
}

/* -------------------------------------------------------------------------- */
/* Counting statistics                                                        */
/* -------------------------------------------------------------------------- */

export function initCounters(): void {
  for (const el of document.querySelectorAll<HTMLElement>('.num[data-count]')) {
    const target = Number(el.dataset.count ?? '0');

    if (prefersReducedMotion) {
      el.textContent = String(target);
      continue;
    }

    const state = { value: 0 };
    gsap.to(state, {
      value: target,
      duration: 1.5,
      ease: 'power2.out',
      // Fires as soon as the number enters the viewport — on tall mobile cards a
      // later start leaves a literal "0" on screen for the reader.
      scrollTrigger: { trigger: el, start: 'top 98%', once: true },
      onUpdate: () => {
        el.textContent = String(Math.round(state.value));
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Meter and spec bars                                                        */
/* -------------------------------------------------------------------------- */

export function initBars(): void {
  const bars = document.querySelectorAll<HTMLElement>('.tile__bar span, .meter__bar i');

  for (const bar of bars) {
    if (prefersReducedMotion) {
      gsap.set(bar, { scaleX: 1 });
      continue;
    }
    gsap.to(bar, {
      scaleX: 1,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 92%', once: true },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Hero entrance                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The hero is its own page, so it gets its own entrance rather than the shared
 * `[data-reveal]` fade: the headline slides up line by line through the masks
 * in the markup, and the supporting elements follow.
 *
 * It is scroll-triggered rather than fired on load, because the reader arrives
 * here from the title section — by the time the hero is on screen the intro is
 * long finished.
 */
export function initHero(): void {
  const hero = document.getElementById('heroSec');
  if (!hero) return;

  const lines = hero.querySelectorAll<HTMLElement>('.hero__line > span');
  const rest = hero.querySelectorAll<HTMLElement>('[data-hero]');

  if (prefersReducedMotion) {
    gsap.set([...lines, ...rest], { opacity: 1, yPercent: 0, y: 0 });
    return;
  }

  const timeline = gsap.timeline({
    defaults: { ease: 'expo.out' },
    scrollTrigger: { trigger: hero, start: 'top 72%', once: true },
  });

  timeline
    .fromTo(
      lines,
      { yPercent: 112 },
      { yPercent: 0, duration: 1.05, stagger: 0.09 },
    )
    .fromTo(
      rest,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
      0.35,
    );
}

/* -------------------------------------------------------------------------- */
/* Video decks                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Videos play muted while on screen and pause when they leave, so the section
 * is alive without ever costing decode time off-screen. The overlay button
 * toggles playback by hand.
 */
export function initVideos(): void {
  for (const figure of document.querySelectorAll<HTMLElement>('.vid')) {
    const shell = figure.querySelector<HTMLElement>('.vid__shell');
    const video = figure.querySelector<HTMLVideoElement>('video');
    const button = figure.querySelector<HTMLButtonElement>('.vid__play');
    const progress = figure.querySelector<HTMLElement>('.vid__prog i');
    if (!shell || !video) continue;

    let userPaused = false;

    const markPlaying = (playing: boolean): void => {
      shell.classList.toggle('is-playing', playing);
      button?.setAttribute('aria-label', playing ? 'Pause this run' : 'Play this run');
    };

    const tryPlay = (): void => {
      // A muted play() can still be rejected; there is nothing to recover, so
      // just leave the poster frame and the play button in place.
      video.play().then(() => markPlaying(true)).catch(() => markPlaying(false));
    };

    button?.addEventListener('click', () => {
      if (video.paused) {
        userPaused = false;
        tryPlay();
      } else {
        userPaused = true;
        video.pause();
        markPlaying(false);
      }
    });

    video.addEventListener('timeupdate', () => {
      if (progress && video.duration) {
        progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
      }
    });

    if (prefersReducedMotion) continue;

    ScrollTrigger.create({
      trigger: figure,
      start: 'top 78%',
      end: 'bottom 22%',
      onEnter: () => { if (!userPaused) tryPlay(); },
      onEnterBack: () => { if (!userPaused) tryPlay(); },
      onLeave: () => { video.pause(); markPlaying(false); },
      onLeaveBack: () => { video.pause(); markPlaying(false); },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Gallery drift                                                              */
/* -------------------------------------------------------------------------- */

/** A gentle parallax on the gallery photographs as they pass through frame. */
export function initGalleryParallax(): void {
  if (prefersReducedMotion) return;

  for (const image of document.querySelectorAll<HTMLElement>('.shot img')) {
    gsap.fromTo(
      image,
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: 'none',
        scrollTrigger: {
          trigger: image.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      },
    );
  }
}
