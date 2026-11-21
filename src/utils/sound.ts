let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (audioCtx !== null && audioCtx.state !== 'closed') {
    try {
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        void Promise.resolve(audioCtx.resume()).catch(() => {});
      }
    } catch {
      // Safe no-op in restricted/headless environments
    }
    return audioCtx;
  }

  audioCtx = null;

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (typeof AudioContextCtor !== 'function') {
      return null;
    }

    audioCtx = new AudioContextCtor();
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      void Promise.resolve(audioCtx.resume()).catch(() => {});
    }
    return audioCtx;
  } catch {
    audioCtx = null;
    return null;
  }
}

/**
 * Unlocks / resumes the shared AudioContext inside a trusted user gesture
 * (e.g. pointerdown when grabbing a crumpled ball or clicking unmute) so
 * subsequent requestAnimationFrame bounce sounds are not blocked by autoplay policy.
 */
export function unlockAudioContext(muted: boolean): void {
  if (muted) {
    return;
  }
  getAudioContext();
}

/**
 * Test helper to reset the lazy AudioContext singleton.
 */
export function resetSoundContext(): void {
  audioCtx = null;
}

/**
 * Synthesizes a subtle ~160ms paper crinkle sound via bandpass-filtered white noise.
 */
export function playCrumpleSound(muted: boolean): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const duration = 0.16;
    const sampleRate = ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2100;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.025);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.055);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.085);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.115);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.13);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + duration);
  } catch {
    // Safe no-op
  }
}

/**
 * Synthesizes a crisp ~45ms push-pin click sound.
 */
export function playPinClickSound(muted: boolean): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  } catch {
    // Safe no-op
  }
}

/**
 * Synthesizes a hollow ~140ms trash basket "plop" sound.
 */
export function playTrashPlopSound(muted: boolean): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(105, t + 0.13);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    // Safe no-op
  }
}

/**
 * Synthesizes a gentle ~150ms upward two-tone chime for restoring a task.
 */
export function playRestoreSound(muted: boolean): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(660, t + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  } catch {
    // Safe no-op
  }
}

export type BounceSurface = 'floor' | 'drawer' | 'trashcan';

/**
 * Synthesizes a tactile bounce sound tailored to the hit surface and scaled by impact speed.
 * - 'floor': crisp crumpled-paper crinkle + soft tap (floor, walls, ceiling)
 * - 'drawer': hollow wooden knock/thud with subtle paper brush
 * - 'trashcan': metallic wire-mesh ring/clink with bright paper brush
 */
export function playBallBounceSound(
  muted: boolean,
  impactSpeed: number = 400,
  surface: BounceSurface = 'floor',
): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const scheduleBounce = () => {
    try {
      const safeSpeed = Number.isFinite(impactSpeed) ? Math.max(0, impactSpeed) : 400;
      const intensity = Math.min(1, Math.max(0.38, safeSpeed / 750));
      const t = ctx.currentTime;
      const sampleRate = ctx.sampleRate || 44100;

      if (surface === 'trashcan') {
        // Metallic wire-mesh ring (two inharmonic partials)
        const ring1 = ctx.createOscillator();
        ring1.type = 'sine';
        ring1.frequency.setValueAtTime(860 + intensity * 140, t);
        ring1.frequency.exponentialRampToValueAtTime(790 + intensity * 100, t + 0.14);

        const ring1Gain = ctx.createGain();
        ring1Gain.gain.setValueAtTime(0.15 * intensity, t);
        ring1Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.145);

        ring1.connect(ring1Gain);
        ring1Gain.connect(ctx.destination);
        ring1.start(t);
        ring1.stop(t + 0.145);

        const ring2 = ctx.createOscillator();
        ring2.type = 'triangle';
        ring2.frequency.setValueAtTime(1340 + intensity * 220, t);
        ring2.frequency.exponentialRampToValueAtTime(1210 + intensity * 160, t + 0.11);

        const ring2Gain = ctx.createGain();
        ring2Gain.gain.setValueAtTime(0.1 * intensity, t);
        ring2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

        ring2.connect(ring2Gain);
        ring2Gain.connect(ctx.destination);
        ring2.start(t);
        ring2.stop(t + 0.115);

        // Bright metallic-paper brush
        const duration = 0.07;
        const frameCount = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = ctx.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3200 + intensity * 500;
        filter.Q.value = 1.8;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.01, t);
        noiseGain.gain.linearRampToValueAtTime(0.2 * intensity, t + 0.008);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        source.start(t);
        source.stop(t + duration);
        return;
      }

      if (surface === 'drawer') {
        // Hollow wooden drawer knock/thud
        const bodyOsc = ctx.createOscillator();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(210 + intensity * 60, t);
        bodyOsc.frequency.exponentialRampToValueAtTime(95, t + 0.105);

        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.26 * intensity, t);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(ctx.destination);
        bodyOsc.start(t);
        bodyOsc.stop(t + 0.11);

        // Secondary woody box overtone
        const overtoneOsc = ctx.createOscillator();
        overtoneOsc.type = 'triangle';
        overtoneOsc.frequency.setValueAtTime(420 + intensity * 80, t);
        overtoneOsc.frequency.exponentialRampToValueAtTime(250, t + 0.06);

        const overtoneGain = ctx.createGain();
        overtoneGain.gain.setValueAtTime(0.11 * intensity, t);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

        overtoneOsc.connect(overtoneGain);
        overtoneGain.connect(ctx.destination);
        overtoneOsc.start(t);
        overtoneOsc.stop(t + 0.065);

        // Short muffled paper-on-wood impact
        const duration = 0.055;
        const frameCount = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = ctx.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 950 + intensity * 250;
        filter.Q.value = 1.2;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.01, t);
        noiseGain.gain.linearRampToValueAtTime(0.18 * intensity, t + 0.008);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        source.start(t);
        source.stop(t + duration);
        return;
      }

      // Default ('floor'): light, dry papery crinkle + gentle tap (no kick-like bass sweep)
      const duration = 0.065;
      const frameCount = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const channelData = buffer.getChannelData(0);

      for (let i = 0; i < frameCount; i++) {
        channelData[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200 + intensity * 600;
      filter.Q.value = 1.15;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.005, t);
      noiseGain.gain.linearRampToValueAtTime(0.15 * intensity, t + 0.01);
      noiseGain.gain.linearRampToValueAtTime(0.06 * intensity, t + 0.028);
      noiseGain.gain.linearRampToValueAtTime(0.11 * intensity, t + 0.04);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      source.start(t);
      source.stop(t + duration);

      // Subtle, ultra-short soft paper-on-desk pat (high-mid, no low-end thump)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(460 + intensity * 90, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.045 * intensity, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.028);
    } catch {
      // Safe no-op
    }
  };

  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    void Promise.resolve(ctx.resume())
      .then(() => {
        if (ctx.state === 'running') {
          scheduleBounce();
        }
      })
      .catch(() => {});
    return;
  }

  scheduleBounce();
}
