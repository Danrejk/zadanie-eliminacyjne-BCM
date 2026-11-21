let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (audioCtx !== null) {
    try {
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        void Promise.resolve(audioCtx.resume()).catch(() => {});
      }
    } catch {
      // Safe no-op in restricted/headless environments
    }
    return audioCtx;
  }

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

/**
 * Synthesizes a short, tactile crumpled-paper bounce sound scaled by impact speed.
 */
export function playBallBounceSound(muted: boolean, impactSpeed: number = 400): void {
  if (muted) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const safeSpeed = Number.isFinite(impactSpeed) ? Math.max(0, impactSpeed) : 400;
    const intensity = Math.min(1, Math.max(0.2, safeSpeed / 1200));
    const t = ctx.currentTime;

    // Short papery crinkle burst
    const duration = 0.065;
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
    filter.frequency.value = 1800 + intensity * 600;
    filter.Q.value = 1.4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.005, t);
    noiseGain.gain.linearRampToValueAtTime(0.11 * intensity, t + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    source.start(t);
    source.stop(t + duration);

    // Subtle low-mid paper tap
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190 + intensity * 70, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.05);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.09 * intensity, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.055);
  } catch {
    // Safe no-op
  }
}
