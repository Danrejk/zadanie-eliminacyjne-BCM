import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playCrumpleSound,
  playPinClickSound,
  playRestoreSound,
  playTrashPlopSound,
  resetSoundContext,
} from '../sound';

interface MockAudioContextHandle {
  ctor: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  oscStart: ReturnType<typeof vi.fn>;
  bufStart: ReturnType<typeof vi.fn>;
}

function installMockAudioContext(state: AudioContextState = 'running'): MockAudioContextHandle {
  const resume = vi.fn().mockResolvedValue(undefined);
  const oscStart = vi.fn();
  const bufStart = vi.fn();

  const createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: oscStart,
    stop: vi.fn(),
  }));

  const createGain = vi.fn(() => ({
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));

  const createBuffer = vi.fn((_channels: number, length: number) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));

  const createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: bufStart,
    stop: vi.fn(),
  }));

  const createBiquadFilter = vi.fn(() => ({
    type: 'bandpass',
    frequency: { value: 0 },
    Q: { value: 0 },
    connect: vi.fn(),
  }));

  const ctor = vi.fn(function MockAudioContext() {
    return {
      state,
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume,
      createOscillator,
      createGain,
      createBuffer,
      createBufferSource,
      createBiquadFilter,
    };
  });

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: ctor,
  });

  return { ctor, resume, oscStart, bufStart };
}

describe('sound', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (
    window as unknown as { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;

  beforeEach(() => {
    resetSoundContext();
  });

  afterEach(() => {
    resetSoundContext();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: originalWebkitAudioContext,
    });
    vi.restoreAllMocks();
  });

  it('acts as a safe no-op when AudioContext and webkitAudioContext are undefined', () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => playCrumpleSound(false)).not.toThrow();
    expect(() => playPinClickSound(false)).not.toThrow();
    expect(() => playTrashPlopSound(false)).not.toThrow();
    expect(() => playRestoreSound(false)).not.toThrow();
  });

  it('never instantiates AudioContext when muted is true', () => {
    const mock = installMockAudioContext();

    playCrumpleSound(true);
    playPinClickSound(true);
    playTrashPlopSound(true);
    playRestoreSound(true);

    expect(mock.ctor).not.toHaveBeenCalled();
    expect(mock.oscStart).not.toHaveBeenCalled();
    expect(mock.bufStart).not.toHaveBeenCalled();
  });

  it('lazily creates and reuses a single AudioContext across all 4 unmuted sounds', () => {
    const mock = installMockAudioContext('running');

    playCrumpleSound(false);
    playPinClickSound(false);
    playTrashPlopSound(false);
    playRestoreSound(false);

    expect(mock.ctor).toHaveBeenCalledTimes(1);
    expect(mock.bufStart).toHaveBeenCalledTimes(1);
    expect(mock.oscStart).toHaveBeenCalledTimes(3);
  });

  it('calls resume() when AudioContext starts in suspended state', () => {
    const mock = installMockAudioContext('suspended');

    playPinClickSound(false);

    expect(mock.ctor).toHaveBeenCalledTimes(1);
    expect(mock.resume).toHaveBeenCalledTimes(1);
  });

  it('catches errors gracefully when AudioContext constructor throws', () => {
    const throwingCtor = vi.fn(function ThrowingAudioContext() {
      throw new Error('Blocked by autoplay policy');
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: throwingCtor,
    });

    expect(() => playCrumpleSound(false)).not.toThrow();
    expect(() => playPinClickSound(false)).not.toThrow();
    expect(() => playTrashPlopSound(false)).not.toThrow();
    expect(() => playRestoreSound(false)).not.toThrow();
  });

  it('catches errors gracefully when reading window.AudioContext getter throws', () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      get() {
        throw new DOMException('Blocked in sandboxed iframe', 'SecurityError');
      },
    });

    expect(() => playCrumpleSound(false)).not.toThrow();
    expect(() => playPinClickSound(false)).not.toThrow();
    expect(() => playTrashPlopSound(false)).not.toThrow();
    expect(() => playRestoreSound(false)).not.toThrow();
  });
});
