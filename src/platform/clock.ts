/**
 * Monotonic session clock for HL;BM — Rune Foundry.
 * Tracks delta time between frames and advances engine production.
 */

export class GameClock {
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private onTickCallback: (deltaSeconds: number) => void;
  private running: boolean = false;

  constructor(onTick: (deltaSeconds: number) => void) {
    this.onTickCallback = onTick;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const elapsed = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp frame delta to maximum 0.1s to avoid huge time jumps on tab switch
    const clampedDelta = Math.min(elapsed, 0.1);
    if (clampedDelta > 0) {
      this.onTickCallback(clampedDelta);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
