/* AudioWorklet: capture mono PCM at 16 kHz in 100 ms packets. */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; this.position = 0; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const value of channel) this.samples.push(value);
    const ratio = sampleRate / 16000;
    const needed = Math.ceil(1600 * ratio);
    if (this.samples.length >= needed) {
      const pcm = new Int16Array(1600);
      let sum = 0;
      for (let i = 0; i < pcm.length; i++) {
        const sample = Math.max(-1, Math.min(1, this.samples[Math.floor(i * ratio)]));
        pcm[i] = Math.round(sample * (sample < 0 ? 32768 : 32767));
        sum += sample * sample;
      }
      this.samples.splice(0, needed);
      this.port.postMessage({ buffer: pcm.buffer, level: Math.sqrt(sum / pcm.length) }, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
