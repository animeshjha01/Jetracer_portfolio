/**
 * PIXEL REVEAL — resolves a photograph block by block as the user scrolls.
 *
 * The image is diced into a grid, the blocks are shuffled once, and scroll
 * progress decides how many of them have been painted. Forward scrolling only
 * paints the newly revealed blocks; scrolling back triggers a full repaint,
 * which keeps the common direction cheap.
 */

/** Target block edge in CSS pixels. Smaller reads finer but costs more draws. */
const BLOCK_SIZE = 15;

export interface PixelReveal {
  /** 0 = fully dissolved, 1 = fully resolved. */
  setProgress(progress: number): void;
  destroy(): void;
}

interface Block {
  /** Source rect in image pixels. */
  sx: number; sy: number; sw: number; sh: number;
  /** Destination rect in canvas backing-store pixels. */
  dx: number; dy: number; dw: number; dh: number;
}

/** Fisher–Yates, so blocks resolve in a scattered order rather than in rows. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function createPixelReveal(
  canvas: HTMLCanvasElement,
  source: string,
  onProgress?: (percent: number) => void,
): PixelReveal {
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = new Image();

  let blocks: Block[] = [];
  let painted = 0;
  let ready = false;
  let progress = 0;

  function clearToPlaceholder(): void {
    if (!ctx) return;
    ctx.fillStyle = '#0B1022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function layout(): void {
    if (!ctx || !image.naturalWidth) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    // Replicate object-fit: cover — crop the source to the canvas aspect
    const canvasAspect = rect.width / rect.height;
    const imageAspect = image.naturalWidth / image.naturalHeight;

    let cropW = image.naturalWidth;
    let cropH = image.naturalHeight;
    if (imageAspect > canvasAspect) cropW = image.naturalHeight * canvasAspect;
    else cropH = image.naturalWidth / canvasAspect;

    const cropX = (image.naturalWidth - cropW) / 2;
    const cropY = (image.naturalHeight - cropH) / 2;

    const cols = Math.max(1, Math.ceil(rect.width / BLOCK_SIZE));
    const rows = Math.max(1, Math.ceil(rect.height / BLOCK_SIZE));

    const next: Block[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // +1 on the destination size hides seams between adjacent blocks
        next.push({
          sx: cropX + (col / cols) * cropW,
          sy: cropY + (row / rows) * cropH,
          sw: cropW / cols,
          sh: cropH / rows,
          dx: Math.floor((col / cols) * canvas.width),
          dy: Math.floor((row / rows) * canvas.height),
          dw: Math.ceil(canvas.width / cols) + 1,
          dh: Math.ceil(canvas.height / rows) + 1,
        });
      }
    }

    blocks = shuffle(next);
    painted = 0;
    clearToPlaceholder();
    render(progress, true);
  }

  function render(value: number, force = false): void {
    if (!ctx || !ready || blocks.length === 0) return;

    const target = Math.round(blocks.length * Math.max(0, Math.min(1, value)));

    if (target < painted || force) {
      // Scrolled back (or relaid out) — repaint from scratch
      clearToPlaceholder();
      painted = 0;
    }

    for (let i = painted; i < target; i++) {
      const b = blocks[i];
      ctx.drawImage(image, b.sx, b.sy, b.sw, b.sh, b.dx, b.dy, b.dw, b.dh);
    }
    painted = target;

    onProgress?.(Math.round((target / blocks.length) * 100));
  }

  image.onload = () => {
    ready = true;
    layout();
  };
  image.src = source;

  const onResize = (): void => layout();
  window.addEventListener('resize', onResize, { passive: true });

  return {
    setProgress(value: number): void {
      progress = value;
      render(value);
    },
    destroy(): void {
      window.removeEventListener('resize', onResize);
    },
  };
}
