/**
 * STAGE — the persistent WebGL scene the JetRacer performs on.
 *
 * Holds the renderer, camera, lighting rig and ground, plus a single render
 * loop that consumers hook into via `onFrame`. The loop parks itself whenever
 * the stage is fully transparent or the tab is hidden, so the page costs
 * nothing once the intro is over.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildJetRacer, type JetRacer } from './jetracer';

export type FrameCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly racer: JetRacer;
  /** Ground grid — scrolled to sell the sense of speed. */
  readonly ground: THREE.Group;
  onFrame(callback: FrameCallback): void;
  start(): void;
  stop(): void;
  /** 0–1. At 0 the render loop idles. */
  setOpacity(value: number): void;
  dispose(): void;
}

/** Height the camera aims at — roughly the deck line of the chassis. */
export const CAMERA_TARGET_Y = 0.075;
/** Low hero angle. */
export const CAMERA_HEIGHT = 0.135;
/** Vertical field of view, in degrees. */
export const CAMERA_FOV = 38;
/** Half-width of world the frame should span, in metres. */
const TARGET_HALF_WIDTH = 0.43;

/**
 * Distance that keeps the car the same size regardless of viewport shape.
 * Framing off a fixed distance is a 16:9 assumption — on a portrait phone the
 * horizontal field collapses and the car overflows the frame, so the camera
 * pulls back as the aspect narrows (capped, or a phone would push it to the
 * horizon).
 */
export function computeFrameDistance(aspect: number): number {
  const halfFov = (CAMERA_FOV / 2) * (Math.PI / 180);
  const distance = TARGET_HALF_WIDTH / (Math.tan(halfFov) * Math.max(aspect, 0.1));
  return Math.min(Math.max(distance, 0.78), 1.85);
}

/** Half-width of the frame at an arbitrary camera distance, for a given aspect. */
export function frameHalfWidthAt(distance: number, aspect: number): number {
  const halfFov = (CAMERA_FOV / 2) * (Math.PI / 180);
  return distance * Math.tan(halfFov) * aspect;
}

/** Half-width of the frame at the working distance, for a given aspect. */
export function computeFrameHalfWidth(aspect: number): number {
  return frameHalfWidthAt(computeFrameDistance(aspect), aspect);
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  /* ---- Renderer -------------------------------------------------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  // Cap DPR at 2 — beyond that the fill cost doubles for no perceptible gain
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  /* ---- Scene ----------------------------------------------------------- */
  const scene = new THREE.Scene();
  // Tight fog so the ground dissolves just past the car. The colour matches the
  // page wash, so the floor melts into the background instead of ending on a seam.
  scene.fog = new THREE.Fog(0xe9f4ec, 1.1, 5.5);

  // A generated room environment gives the chrome rims and anodized aluminium
  // something to reflect. Without it every metal surface renders near-black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  /* ---- Camera ---------------------------------------------------------- */
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.02, 60);
  camera.position.set(0, CAMERA_HEIGHT, computeFrameDistance(1.6));
  camera.lookAt(0, CAMERA_TARGET_Y, 0);

  /* ---- Lighting -------------------------------------------------------- */
  // Bright neutral sky over a mint bounce, matching the page wash — this is what
  // keeps the car readable against a light page.
  scene.add(new THREE.HemisphereLight(0xf6fbff, 0xd8ecdd, 2.2));

  // Key light — the only shadow caster in the scene
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(1.4, 2.2, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 7;
  key.shadow.camera.left = -1.2;
  key.shadow.camera.right = 1.2;
  key.shadow.camera.top = 1.2;
  key.shadow.camera.bottom = -1.2;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.012;
  scene.add(key);

  // Anodized-green rim from behind, chrome-blue fill from the front left — the
  // car lit by its own colours
  const rim = new THREE.DirectionalLight(0x22c55e, 2.6);
  rim.position.set(-1.8, 0.9, -1.4);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x3b8ef0, 1.4);
  fill.position.set(-1.2, 0.6, 1.8);
  scene.add(fill);

  // Close warm accent that puts a highlight along the top deck as it passes
  const accent = new THREE.PointLight(0xffe8c4, 1.6, 2.2, 2);
  accent.position.set(0.1, 0.5, 0.45);
  scene.add(accent);

  /* ---- Ground ---------------------------------------------------------- */
  const ground = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 40),
    // Slightly polished so the underglow and rim light smear across it
    new THREE.MeshStandardMaterial({ color: 0xe8f3ec, roughness: 0.55, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  ground.add(floor);

  // Grid gives the eye something to measure speed against as the camera tracks.
  // 0.25 m cells: fine enough to read as the car streams over them.
  const grid = new THREE.GridHelper(80, 320, 0x1f9d3c, 0x3b8ef0);
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  // Dark lines on a light floor need less opacity than light-on-dark did
  gridMaterial.opacity = 0.4;
  grid.position.y = 0.001;
  ground.add(grid);

  scene.add(ground);

  /* ---- Vehicle --------------------------------------------------------- */
  const quality: 'low' | 'high' = window.innerWidth < 720 ? 'low' : 'high';
  const racer = buildJetRacer({ quality });
  scene.add(racer.group);

  /* ---- Sizing ---------------------------------------------------------- */
  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ---- Render loop ----------------------------------------------------- */
  const callbacks: FrameCallback[] = [];
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let opacity = 0;

  function tick(): void {
    rafId = requestAnimationFrame(tick);

    // Clamp delta so a backgrounded tab does not teleport the car on return
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    for (const cb of callbacks) cb(delta, elapsed);
    renderer.render(scene, camera);
  }

  function start(): void {
    if (running) return;
    running = true;
    clock.getDelta(); // discard the idle gap
    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
  }

  // Don't burn frames on a hidden tab
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (opacity > 0) start();
  });

  return {
    scene,
    camera,
    racer,
    ground,

    onFrame(callback: FrameCallback): void {
      callbacks.push(callback);
    },

    start,
    stop,

    setOpacity(value: number): void {
      opacity = Math.max(0, Math.min(1, value));
      canvas.style.opacity = String(opacity);
      if (opacity <= 0.001) stop();
      else if (!document.hidden) start();
    },

    dispose(): void {
      stop();
      window.removeEventListener('resize', resize);
      racer.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
