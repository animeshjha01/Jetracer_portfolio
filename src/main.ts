/**
 * JET RACER — entry point.
 *
 * Orchestrates the whole experience:
 *   1. Boot gate, scroll locked, ember ignition button — assembled by GSAP.
 *   2. Press → shockwave, flash, the JetRacer crosses a locked-off frame at 30 km/h.
 *   3. Scroll unlocks and auto-advances to the title, which flies in per glyph.
 *   4. The hero page lands next, then the page is scroll-driven: the pixel
 *      reveal, the spec bento, the network bridge, the evasion sequence, the
 *      gallery and the footage.
 */

import './styles/main.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createStage } from './scene/stage';
import { createHud } from './ui/hud';
import { runDriveBy, createIdlePose } from './sequence/driveBy';
import { createPixelReveal } from './sequence/pixelReveal';
import { playBootEntrance, playIgnition } from './sequence/intro';
import { initCometCards } from './ui/cometCard';
import {
  prefersReducedMotion,
  initReveals,
  initCounters,
  initBars,
  initHero,
  initVideos,
  initGalleryParallax,
  primeWordmark,
  playWordmark,
} from './ui/scrollAnimations';

gsap.registerPlugin(ScrollTrigger);

/* -------------------------------------------------------------------------- */
/* Cold start                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Puts the reader back at the top, so a reload from anywhere in the document
 * lands on the boot gate rather than mid-sequence.
 *
 * The half of this that has to run before the bundle — disabling the browser's
 * scroll restoration and stripping a leftover `#section` hash — lives in an
 * inline head script in index.html; see the comment there for why it cannot
 * live here. This is just the reset itself.
 *
 * `behavior: 'instant'` matters: `html` sets `scroll-behavior: smooth`, so a
 * plain `scrollTo` would animate the whole way back up in full view.
 */
function forceColdStart(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

/* -------------------------------------------------------------------------- */
/* Scroll lock                                                                */
/* -------------------------------------------------------------------------- */

function lockScroll(): void {
  document.documentElement.classList.add('is-locked');
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

function unlockScroll(): void {
  document.documentElement.classList.remove('is-locked');
  ScrollTrigger.refresh();
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

function main(): void {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  const boot = document.getElementById('boot');
  const startBtn = document.getElementById('startBtn');
  const driveLine = document.getElementById('driveLine');
  const driveReadout = document.querySelector<HTMLElement>('.drive__readout');
  if (!canvas || !boot || !startBtn) return;

  forceColdStart();
  lockScroll();
  primeWordmark();
  playBootEntrance();

  const stage = createStage(canvas);
  const hud = createHud();

  /* ---- Stage opacity is scroll-driven once the intro is over ------------ */
  const stageOpacity = { value: 0 };
  const applyStageOpacity = (): void => stage.setOpacity(stageOpacity.value);

  function fadeStageTo(value: number, duration = 0.6): void {
    gsap.to(stageOpacity, {
      value,
      duration,
      ease: 'power2.out',
      onUpdate: applyStageOpacity,
    });
  }

  /* ---- Idle turntable behind the title ---------------------------------- */
  let idleActive = false;
  const updateIdle = createIdlePose(stage);
  stage.onFrame((delta) => {
    if (idleActive) updateIdle(delta);
  });

  /* ---- Page-wide scroll behaviour --------------------------------------- */
  initReveals();
  initCounters();
  initBars();
  initHero();
  initCometCards();
  initVideos();
  initGalleryParallax();

  // Pixel reveal — the photograph resolves as the section scrolls into place
  const pixelCanvas = document.getElementById('pixelCanvas') as HTMLCanvasElement | null;
  const pixelPct = document.getElementById('pixelPct');
  if (pixelCanvas) {
    const reveal = createPixelReveal(pixelCanvas, 'media/robot-front.jpeg', (percent) => {
      if (pixelPct) pixelPct.textContent = String(percent);
    });

    if (prefersReducedMotion) {
      reveal.setProgress(1);
    } else {
      ScrollTrigger.create({
        trigger: '#pixelSec',
        start: 'top 82%',
        end: 'top 12%',
        scrub: 0.7,
        onUpdate: (self) => reveal.setProgress(self.progress),
      });
    }
  }

  // The car is a subject on the title screen now, not a backdrop behind it — it
  // sits in the right-hand column beside the copy, so it stays fully opaque and
  // only fades once the content sections begin.
  ScrollTrigger.create({
    trigger: '#titleSec',
    start: 'top 60%',
    end: 'bottom 40%',
    onEnter: () => fadeStageTo(1),
    onEnterBack: () => fadeStageTo(1),
    onLeave: () => fadeStageTo(0, 0.5),
    onLeaveBack: () => fadeStageTo(1, 0.5),
  });

  document.getElementById('toTop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });

  /* ---- The ignition ------------------------------------------------------ */
  let started = false;

  async function ignite(): Promise<void> {
    if (started) return;
    started = true;

    // Punch, discharge and clear the gate
    await playIgnition(startBtn!, boot!);

    stageOpacity.value = 1;
    applyStageOpacity();

    if (driveReadout) {
      gsap.to(driveReadout, { opacity: 1, duration: 0.4 });
    }

    // The run itself
    await runDriveBy({
      stage,
      hud,
      statusEl: driveLine,
      instant: prefersReducedMotion,
    });

    // Hand the page back to the reader
    idleActive = true;
    unlockScroll();

    const title = document.getElementById('titleSec');
    if (title) {
      if (prefersReducedMotion) {
        title.scrollIntoView();
        playWordmark();
      } else {
        // Auto-advance to the title, then fly the glyphs in behind the scroll
        title.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(playWordmark, 620);
      }
    }
  }

  startBtn.addEventListener('click', () => void ignite());

  window.addEventListener('load', () => {
    // Photographs and video metadata can push `load` out far enough that the
    // browser's scroll restoration lands after the reset above, so pin it once
    // more — but only while the gate is still up, or this would yank a reader
    // who has already pressed START back to the top mid-run.
    if (!started) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Keep the layout honest once fonts and images have settled
    ScrollTrigger.refresh();
  });

  // Back/forward restores from the bfcache hand back a fully live page, frozen
  // wherever it was left — including part-way through the intro, which has no
  // sensible resume point. Starting it over is the only coherent thing to do.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}

main();
