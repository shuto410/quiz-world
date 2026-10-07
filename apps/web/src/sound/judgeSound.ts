/**
 * The correct and wrong cues, synthesised in the browser.
 *
 * No audio files: a two-note chime for correct and a double buzz for wrong are a few
 * oscillators each, which keeps the bundle and the hosting free of assets to license or cache.
 *
 * Browsers keep an audio context suspended until the page has seen a user gesture. A cue that
 * arrives before that is dropped rather than queued, because a queued chime would ring out of
 * nowhere on the user's first click. `unlockJudgeSound` resumes the context on that first
 * gesture so later cues play.
 */

/** One note: when it starts relative to the cue, how long it rings, and what it sounds like. */
type Note = { at: number; duration: number; frequency: number; type: OscillatorType; gain: number };

const CORRECT: readonly Note[] = [
  { at: 0, duration: 0.22, frequency: 1318.5, type: 'sine', gain: 0.22 },
  { at: 0.18, duration: 0.6, frequency: 1046.5, type: 'sine', gain: 0.22 },
];
const WRONG: readonly Note[] = [
  { at: 0, duration: 0.16, frequency: 147, type: 'square', gain: 0.09 },
  { at: 0.22, duration: 0.45, frequency: 147, type: 'square', gain: 0.09 },
];

let context: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  context ??= new AudioContext();
  return context;
}

/** Plays the cue now, or not at all if the browser has not allowed sound yet. */
export function playJudgeSound(isCorrect: boolean): void {
  const audio = audioContext();
  if (audio === undefined) return;
  if (audio.state !== 'running') {
    void audio.resume().catch(() => undefined);
    return;
  }
  const start = audio.currentTime + 0.01;
  for (const note of isCorrect ? CORRECT : WRONG) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const from = start + note.at;
    oscillator.type = note.type;
    oscillator.frequency.value = note.frequency;
    envelope.gain.setValueAtTime(0.0001, from);
    envelope.gain.exponentialRampToValueAtTime(note.gain, from + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, from + note.duration);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(from);
    oscillator.stop(from + note.duration + 0.02);
  }
}

/** Resumes audio on the first gesture after a reload. Returns the cleanup for an effect. */
export function unlockJudgeSound(): () => void {
  const resume = () => {
    const audio = audioContext();
    if (audio !== undefined && audio.state !== 'running')
      void audio.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  return () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
}
