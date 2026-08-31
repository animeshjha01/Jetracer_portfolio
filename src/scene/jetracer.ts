/**
 * JETRACER — PROCEDURAL 3D MODEL
 * ---------------------------------------------------------------------------
 * A hand-built Three.js reconstruction of the Waveshare JetRacer ROS AI robot
 * used in this project, modelled directly from the reference photographs.
 *
 * Real-world reference (all units are METRES — 1 world unit = 1 m):
 *   · Anodized green aluminium chassis plate       ~245 x 145 x 4 mm
 *   · Black EVA foam front bumper wrapping the nose
 *   · 4x blue chrome 10-spoke rims, knobby tyres   r = 34 mm, w = 26 mm
 *   · Black acrylic upper deck on brass standoffs
 *   · Cylindrical 360° LiDAR (rotating drum)       r = 38 mm, h = 32 mm
 *   · NVIDIA Jetson Nano + finned black heatsink
 *   · 2x black dipole WiFi antennas, raked back
 *   · Green camera mast carrying a wide-angle CSI camera
 *   · 2x silver Waveshare 12V 333RPM geared motors
 *
 * Orientation: the vehicle drives along +X. Wheel geometry is pre-rotated so
 * the axle lies on Z — a wheel therefore spins on `rotation.z` and steers on
 * the parent knuckle's `rotation.y`.
 */

import * as THREE from 'three';

/** Vehicle dimensions in metres, taken from the physical module. */
export const DIMENSIONS = {
  wheelRadius: 0.034,
  wheelWidth: 0.026,
  wheelbase: 0.205,
  track: 0.168,
  deckY: 0.038,
  plateThickness: 0.004,
  upperDeckY: 0.098,
  lidarY: 0.126,
  length: 0.33,
} as const;

export type ModelQuality = 'low' | 'high';

export interface JetRacerOptions {
  /** Lowers segment counts and tread detail for mobile / background instances. */
  quality?: ModelQuality;
  /** Underglow colour. Defaults to the anodized green of the chassis. */
  glowColor?: THREE.ColorRepresentation;
}

export interface JetRacer {
  /** Root object — position and rotate this to drive the car. */
  readonly group: THREE.Group;
  /** Sprung mass. Receives squat, roll and suspension chatter. */
  readonly body: THREE.Group;
  readonly wheels: THREE.Group[];
  readonly lidar: THREE.Group;
  /**
   * Advance wheel spin, LiDAR rotation and suspension.
   *
   * `speedMetresPerSecond` is the true ground velocity and drives wheel
   * rotation, so the tyres never slip against the ground.
   *
   * `loadRatio` (0–1) is how hard the car is being driven, and scales the
   * suspension chatter and squat. It defaults to the speed as a fraction of
   * `TOP_SPEED_MPS`, which is right whenever world velocity and apparent effort
   * are the same thing. The drive-by passes it explicitly: there the world
   * velocity is scaled down to keep the pass watchable, so deriving load from it
   * would leave the car sitting dead still on its springs.
   */
  update(deltaSeconds: number, speedMetresPerSecond: number, loadRatio?: number): void;
  /** Steering angle in radians, applied to the two front knuckles. */
  setSteer(angleRadians: number): void;
  setUnderglow(color: THREE.ColorRepresentation, opacity?: number): void;
  dispose(): void;
}

interface Materials {
  green: THREE.MeshStandardMaterial;
  greenDark: THREE.MeshStandardMaterial;
  foam: THREE.MeshStandardMaterial;
  acrylic: THREE.MeshStandardMaterial;
  lidarShell: THREE.MeshStandardMaterial;
  tyre: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  rimDark: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  pcb: THREE.MeshStandardMaterial;
  pcbDark: THREE.MeshStandardMaterial;
  heatsink: THREE.MeshStandardMaterial;
  motor: THREE.MeshStandardMaterial;
  plastic: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  ledGreen: THREE.MeshStandardMaterial;
  ledRed: THREE.MeshStandardMaterial;
  ledBlue: THREE.MeshStandardMaterial;
}

function createMaterials(): Materials {
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial(p);

  return {
    // Anodized green aluminium — the signature chassis finish
    green: std({ color: 0x1f9d3c, metalness: 0.62, roughness: 0.34 }),
    greenDark: std({ color: 0x14682a, metalness: 0.55, roughness: 0.42 }),
    // Matte black EVA foam bumper
    foam: std({ color: 0x121214, metalness: 0.0, roughness: 0.96 }),
    // Black acrylic decks and LiDAR shell
    acrylic: std({ color: 0x17171b, metalness: 0.22, roughness: 0.48 }),
    lidarShell: std({ color: 0x1c1c20, metalness: 0.3, roughness: 0.42 }),
    tyre: std({ color: 0x0c0c0e, metalness: 0.0, roughness: 0.92 }),
    // Blue chrome rim. Metal draws its colour almost entirely from reflections,
    // so the env intensity is pushed well above 1 to make the chrome read in a
    // scene this dark.
    rim: std({ color: 0x3b8ef0, metalness: 1.0, roughness: 0.1, envMapIntensity: 2.6 }),
    rimDark: std({ color: 0x0d3f8c, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.6 }),
    brass: std({ color: 0xbb924c, metalness: 0.92, roughness: 0.31 }),
    pcb: std({ color: 0x0f5230, metalness: 0.35, roughness: 0.65 }),
    pcbDark: std({ color: 0x2a2320, metalness: 0.4, roughness: 0.6 }),
    heatsink: std({ color: 0x2a2d33, metalness: 0.85, roughness: 0.38 }),
    motor: std({ color: 0xb6bcc4, metalness: 0.94, roughness: 0.26 }),
    plastic: std({ color: 0x1a1a1e, metalness: 0.18, roughness: 0.62 }),
    glass: std({ color: 0x0a0d16, metalness: 0.6, roughness: 0.08 }),
    // Emissive status LEDs
    ledGreen: std({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 3.2, roughness: 0.4 }),
    ledRed: std({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 3.2, roughness: 0.4 }),
    ledBlue: std({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 2.4, roughness: 0.4 }),
  };
}

/* -------------------------------------------------------------------------- */
/* Primitive helpers                                                          */
/* -------------------------------------------------------------------------- */

function box(
  w: number, h: number, d: number,
  material: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(
  radiusTop: number, radiusBottom: number, height: number, segments: number,
  material: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * A soft radial gradient used as the alpha ramp for the underglow, so the wash
 * fades out at its edges instead of ending on a hard rectangle.
 */
function createRadialFalloff(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

/* -------------------------------------------------------------------------- */
/* Wheel — knobby tyre over a blue chrome 10-spoke rim                        */
/* -------------------------------------------------------------------------- */

function buildWheel(mat: Materials, quality: ModelQuality): THREE.Group {
  const wheel = new THREE.Group();
  const segments = quality === 'low' ? 16 : 28;
  const { wheelRadius: r, wheelWidth: w } = DIMENSIONS;
  const rimRadius = r * 0.64;

  // Tread band only — open-ended, so the rim inside stays visible. A solid
  // cylinder here would swallow the whole chrome centre.
  const tread = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, w, segments, 1, true),
    mat.tyre,
  );
  tread.rotation.x = Math.PI / 2; // align the axle to Z
  wheel.add(tread);

  // Sidewalls: annuli spanning rim edge to tread, one per face
  const sidewallMaterial = mat.tyre.clone();
  sidewallMaterial.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const sidewall = new THREE.Mesh(
      new THREE.RingGeometry(rimRadius * 0.98, r, segments),
      sidewallMaterial,
    );
    sidewall.position.z = side * (w / 2);
    wheel.add(sidewall);
  }

  // Knobby tread blocks around the circumference
  const blockCount = quality === 'low' ? 10 : 18;
  for (let i = 0; i < blockCount; i++) {
    const angle = (i / blockCount) * Math.PI * 2;
    const knob = box(0.007, 0.004, w * 0.86, mat.tyre);
    knob.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    knob.rotation.z = angle;
    wheel.add(knob);
  }

  // Inner rim wall — open-ended as well, so the spoke pattern in front of it
  // stays readable instead of being capped off by a flat disc.
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius, rimRadius, w * 0.88, segments, 1, true),
    mat.rimDark,
  );
  barrel.rotation.x = Math.PI / 2;
  wheel.add(barrel);

  // Rim face on each side: chrome lip, dished centre, ten swept spokes
  for (const side of [-1, 1]) {
    const faceZ = side * w * 0.34;

    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius, 0.0022, 6, segments),
      mat.rim,
    );
    lip.position.z = faceZ;
    wheel.add(lip);

    const dish = cylinder(rimRadius * 0.34, rimRadius * 0.34, 0.004, 16, mat.rimDark);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = faceZ;
    wheel.add(dish);

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spoke = box(rimRadius * 0.94, 0.0052, 0.0055, mat.rim);
      spoke.position.set(
        Math.cos(angle) * rimRadius * 0.5,
        Math.sin(angle) * rimRadius * 0.5,
        faceZ,
      );
      spoke.rotation.z = angle + 0.34; // the slight sweep of the real rim
      wheel.add(spoke);
    }
  }

  // Hub and centre screw
  const hub = cylinder(0.0075, 0.0075, w * 1.04, 12, mat.rim);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);

  const screw = cylinder(0.003, 0.003, w * 1.12, 8, mat.motor);
  screw.rotation.x = Math.PI / 2;
  wheel.add(screw);

  return wheel;
}

/* -------------------------------------------------------------------------- */
/* LiDAR — static base with a rotating optical drum                           */
/* -------------------------------------------------------------------------- */

function buildLidar(mat: Materials, quality: ModelQuality): {
  group: THREE.Group;
  drum: THREE.Group;
} {
  const group = new THREE.Group();
  const segments = quality === 'low' ? 18 : 32;

  group.add(cylinder(0.04, 0.042, 0.01, segments, mat.acrylic));

  const drum = new THREE.Group();
  drum.position.y = 0.021;
  drum.add(cylinder(0.038, 0.038, 0.032, segments, mat.lidarShell));

  // Optical windows
  drum.add(box(0.016, 0.013, 0.005, mat.glass, 0, 0.001, 0.037));
  const window2 = box(0.01, 0.01, 0.005, mat.glass, 0.028, 0.001, 0.024);
  window2.rotation.y = -0.9;
  drum.add(window2);

  // Top cap and index dot
  drum.add(cylinder(0.038, 0.038, 0.004, segments, mat.acrylic, 0, 0.018, 0));
  drum.add(cylinder(0.006, 0.006, 0.002, 12, mat.plastic, 0.018, 0.021, 0));

  group.add(drum);
  return { group, drum };
}

/* -------------------------------------------------------------------------- */
/* Camera mast — green bracket carrying the wide-angle CSI camera             */
/* -------------------------------------------------------------------------- */

function buildCameraMast(mat: Materials): THREE.Group {
  const group = new THREE.Group();

  group.add(box(0.01, 0.058, 0.03, mat.green, 0, 0.029, 0));

  const head = box(0.008, 0.026, 0.03, mat.green, 0.004, 0.064, 0);
  head.rotation.z = -0.22;
  group.add(head);

  group.add(box(0.004, 0.024, 0.025, mat.pcbDark, 0.011, 0.066, 0));

  const barrel = cylinder(0.0075, 0.0085, 0.014, 16, mat.plastic, 0.019, 0.066, 0);
  barrel.rotation.z = Math.PI / 2;
  group.add(barrel);

  const lens = cylinder(0.0058, 0.0058, 0.004, 16, mat.glass, 0.027, 0.066, 0);
  lens.rotation.z = Math.PI / 2;
  group.add(lens);

  return group;
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

export function buildJetRacer(options: JetRacerOptions = {}): JetRacer {
  const quality: ModelQuality = options.quality ?? 'high';
  const mat = createMaterials();

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const { wheelRadius, wheelbase, track, deckY, upperDeckY, lidarY } = DIMENSIONS;
  const halfTrack = track / 2;
  const frontX = wheelbase / 2;
  const rearX = -wheelbase / 2;

  /* ---- Wheels ---------------------------------------------------------- */
  const wheels: THREE.Group[] = [];
  const steeringKnuckles: THREE.Group[] = [];

  const wheelLayout = [
    { x: frontX, z: halfTrack, steers: true },
    { x: frontX, z: -halfTrack, steers: true },
    { x: rearX, z: halfTrack, steers: false },
    { x: rearX, z: -halfTrack, steers: false },
  ];

  for (const spec of wheelLayout) {
    // The knuckle wraps the wheel so steering yaw and spin stay independent
    const knuckle = new THREE.Group();
    knuckle.position.set(spec.x, wheelRadius, spec.z);

    const wheel = buildWheel(mat, quality);
    knuckle.add(wheel);
    body.add(knuckle);

    wheels.push(wheel);
    if (spec.steers) steeringKnuckles.push(knuckle);
  }

  /* ---- Main green chassis plate ---------------------------------------- */
  const plate = box(0.245, DIMENSIONS.plateThickness, 0.145, mat.green, 0, deckY, 0);
  plate.receiveShadow = true;
  body.add(plate);

  for (const side of [-1, 1]) {
    body.add(box(0.2, 0.014, 0.005, mat.greenDark, -0.008, deckY - 0.008, side * 0.07));
  }

  // Front suspension deck, steering linkage and servo
  body.add(box(0.058, 0.004, 0.15, mat.green, 0.108, deckY - 0.002, 0));
  body.add(box(0.006, 0.004, 0.104, mat.greenDark, 0.1, 0.03, 0));
  body.add(box(0.03, 0.02, 0.016, mat.plastic, 0.082, 0.03, 0.012));

  /* ---- Black EVA foam front bumper ------------------------------------- */
  const bumper = box(0.03, 0.026, 0.15, mat.foam, 0.148, 0.026, 0);
  body.add(bumper);

  for (const side of [-1, 1]) {
    const cap = cylinder(0.013, 0.013, 0.03, 14, mat.foam, 0.146, 0.026, side * 0.073);
    cap.rotation.x = Math.PI / 2;
    cap.rotation.z = Math.PI / 2;
    body.add(cap);
  }
  body.add(box(0.034, 0.004, 0.15, mat.green, 0.148, 0.041, 0));

  /* ---- Rear geared motors ---------------------------------------------- */
  for (const side of [-1, 1]) {
    const can = cylinder(0.0125, 0.0125, 0.056, 18, mat.motor, rearX - 0.004, 0.03, side * 0.044);
    can.rotation.x = Math.PI / 2;
    can.rotation.z = Math.PI / 2;
    body.add(can);

    // Encoder board with a live status LED
    body.add(box(0.012, 0.014, 0.014, mat.pcb, rearX + 0.03, 0.03, side * 0.044));
    body.add(box(0.003, 0.003, 0.002, mat.ledGreen, rearX + 0.03, 0.036, side * 0.044));
  }

  /* ---- Jetson Nano carrier board and heatsink -------------------------- */
  body.add(box(0.1, 0.003, 0.08, mat.pcb, -0.01, deckY + 0.01, 0));

  const heatsink = box(0.058, 0.02, 0.058, mat.heatsink, -0.014, deckY + 0.022, 0);
  body.add(heatsink);
  for (let i = 0; i < 7; i++) {
    body.add(box(0.004, 0.01, 0.058, mat.heatsink, -0.038 + i * 0.008, deckY + 0.037, 0));
  }

  // I/O stack: USB ports, ethernet jack, GPIO header
  for (let i = 0; i < 3; i++) {
    body.add(box(0.014, 0.011, 0.015, mat.motor, -0.052, deckY + 0.018, -0.022 + i * 0.02));
  }
  body.add(box(0.016, 0.013, 0.016, mat.plastic, 0.03, deckY + 0.019, -0.026));
  for (let i = 0; i < 10; i++) {
    body.add(box(0.0018, 0.005, 0.0018, mat.brass, 0.026, deckY + 0.015, -0.018 + i * 0.004));
  }

  // Expansion board status LEDs
  body.add(box(0.003, 0.002, 0.003, mat.ledRed, 0.014, deckY + 0.013, 0.03));
  body.add(box(0.003, 0.002, 0.003, mat.ledBlue, 0.02, deckY + 0.013, 0.03));

  /* ---- Brass standoffs and black acrylic upper deck -------------------- */
  const standoffs: Array<[number, number]> = [
    [0.048, 0.052], [0.048, -0.052], [-0.062, 0.052], [-0.062, -0.052],
  ];
  for (const [x, z] of standoffs) {
    body.add(cylinder(0.0026, 0.0026, upperDeckY - deckY, 6, mat.brass, x, (upperDeckY + deckY) / 2, z));
  }

  const upperDeck = box(0.13, 0.004, 0.118, mat.acrylic, -0.006, upperDeckY, 0);
  body.add(upperDeck);

  // Short second tier that lifts the LiDAR clear of the deck
  const lidarPosts: Array<[number, number]> = [
    [0.03, 0.032], [0.03, -0.032], [-0.042, 0.032], [-0.042, -0.032],
  ];
  for (const [x, z] of lidarPosts) {
    body.add(cylinder(0.0022, 0.0022, 0.022, 6, mat.plastic, x, upperDeckY + 0.013, z));
  }
  body.add(box(0.086, 0.003, 0.086, mat.acrylic, -0.006, upperDeckY + 0.025, 0));

  /* ---- LiDAR ----------------------------------------------------------- */
  const { group: lidar, drum: lidarDrum } = buildLidar(mat, quality);
  lidar.position.set(-0.006, lidarY, 0);
  body.add(lidar);

  /* ---- Antennas -------------------------------------------------------- */
  for (const side of [-1, 1]) {
    const antenna = new THREE.Group();
    antenna.position.set(-0.07, deckY + 0.014, side * 0.056);
    antenna.add(cylinder(0.004, 0.004, 0.008, 10, mat.brass, 0, 0.004, 0));
    antenna.add(cylinder(0.0028, 0.0034, 0.098, 10, mat.plastic, 0, 0.056, 0));
    antenna.add(cylinder(0.0022, 0.0028, 0.008, 10, mat.plastic, 0, 0.108, 0));
    antenna.rotation.z = 0.2;          // raked back
    antenna.rotation.x = -side * 0.16; // splayed outward
    body.add(antenna);
  }

  /* ---- Camera mast ----------------------------------------------------- */
  const cameraMast = buildCameraMast(mat);
  cameraMast.position.set(0.062, deckY + 0.002, 0.028);
  body.add(cameraMast);

  /* ---- Underglow -------------------------------------------------------
     A soft wash under the chassis echoing the anodized plate. Drawn as an
     additive plane rather than a real light: a PointLight per car is not worth
     the per-frame cost in a scroll-driven scene. The radial alpha ramp is what
     keeps it reading as light instead of a painted rectangle. */
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: options.glowColor ?? 0x22c55e,
    map: createRadialFalloff(),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.003;
  body.add(glow);

  /* ---- Shadow configuration --------------------------------------------
     Only the hero silhouettes cast. Flagging every mesh would push the whole
     graph through the shadow pass on every frame for no visible gain. */
  plate.castShadow = true;
  upperDeck.castShadow = true;
  bumper.castShadow = true;
  heatsink.castShadow = true;
  for (const wheel of wheels) {
    wheel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });
  }

  /* ---- Animation state -------------------------------------------------- */
  let wheelSpin = 0;
  let lidarSpin = 0;
  let elapsed = 0;

  /** Reference speed for the default load ratio, when none is supplied. */
  const TOP_SPEED_MPS = 5.56;

  return {
    group,
    body,
    wheels,
    lidar,

    update(deltaSeconds: number, speedMetresPerSecond: number, loadRatio?: number): void {
      const speed = speedMetresPerSecond || 0;
      elapsed += deltaSeconds;

      // Wheel rotation derives from real ground speed (omega = v / r), so the
      // tyres never slip against the ground they are standing on.
      wheelSpin -= (speed / wheelRadius) * deltaSeconds;
      for (const wheel of wheels) wheel.rotation.z = wheelSpin;

      // The LiDAR drum turns at a constant ~5 Hz regardless of vehicle speed
      lidarSpin += deltaSeconds * Math.PI * 2 * 5;
      lidarDrum.rotation.y = lidarSpin;

      // Suspension chatter and squat under power, scaled by how hard it is being
      // driven rather than by raw world velocity — see `update` on the interface.
      const load = Math.min(loadRatio ?? speed / TOP_SPEED_MPS, 1);
      body.position.y = Math.sin(elapsed * 34) * 0.0016 * load;
      body.rotation.z = -0.03 * load + Math.sin(elapsed * 21) * 0.006 * load;
      body.rotation.x = Math.sin(elapsed * 27) * 0.005 * load;

      // Underglow breathes at rest and intensifies with speed
      glowMaterial.opacity = 0.18 + load * 0.34 + Math.sin(elapsed * 3) * 0.05;
    },

    setSteer(angleRadians: number): void {
      for (const knuckle of steeringKnuckles) knuckle.rotation.y = angleRadians;
    },

    setUnderglow(color: THREE.ColorRepresentation, opacity?: number): void {
      glowMaterial.color.set(color);
      if (opacity !== undefined) glowMaterial.opacity = opacity;
    },

    dispose(): void {
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      });
    },
  };
}
