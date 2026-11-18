// Procedural sound: WebAudio oscillators and generated noise only. No files, no network, no
// audio elements. Every effect is built at call time and routed through one master gain.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    ctx = new Audio();
    master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, endFreq, duration, type, volume) {
    if (muted || !ensure()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, frequency) {
    if (muted || !ensure()) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency || 900;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function looping(frequency, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.out = gain;
    return osc;
  }

  return {
    resume: ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.2;
      return muted;
    },
    shoot() { tone(760, 180, 0.12, 'square', 0.22); noise(0.08, 0.16, 1600); },
    hit() { tone(180, 60, 0.22, 'sawtooth', 0.3); },
    crash() { noise(0.32, 0.35, 420); tone(120, 50, 0.3, 'sawtooth', 0.2); },
    cash() { tone(880, 1320, 0.09, 'square', 0.2); tone(1320, 1760, 0.12, 'square', 0.16); },
    mission() { tone(523, 523, 0.12, 'square', 0.2); tone(659, 659, 0.14, 'square', 0.2); tone(784, 1046, 0.24, 'square', 0.2); },
    engine(speed, active) {
      if (muted || !ensure()) return;
      if (!engineOsc) {
        engineOsc = looping(80, 'sawtooth');
        engineGain = engineOsc.out;
      }
      engineOsc.frequency.setTargetAtTime(70 + Math.min(190, Math.abs(speed) * 0.75), ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(active ? 0.1 : 0, ctx.currentTime, 0.12);
    },
    siren(wanted) {
      if (muted || !ensure()) return;
      if (!sirenOsc) {
        sirenOsc = looping(620, 'triangle');
        sirenGain = sirenOsc.out;
      }
      sirenOsc.frequency.setTargetAtTime(Math.floor(ctx.currentTime * 3) % 2 ? 760 : 520, ctx.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(wanted > 0 ? Math.min(0.09, 0.03 * wanted) : 0, ctx.currentTime, 0.2);
    },
  };
}
