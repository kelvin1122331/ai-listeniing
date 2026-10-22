import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
describe("AudioWorklet capture", () => {
  it.each([16000, 48000])("produces 100ms PCM packets at 16kHz from %sHz input", rate => {
    const packets: { buffer: ArrayBuffer; level: number }[] = [];
    let Processor!: new () => { process(inputs: Float32Array[][]): boolean };
    const context = {
      AudioWorkletProcessor: class { port = { postMessage: (packet: { buffer: ArrayBuffer; level: number }) => packets.push(packet) }; },
      sampleRate: rate,
      registerProcessor: (_name: string, implementation: typeof Processor) => { Processor = implementation; },
    };
    vm.runInNewContext(fs.readFileSync("public/pcm-capture.js", "utf8"), context);
    const processor = new Processor();
    for (let i = 0; i < Math.ceil(rate / 10 / 128); i++) processor.process([[new Float32Array(128).fill(0.5)]]);
    expect(packets).toHaveLength(1);
    const pcm = new Int16Array(packets[0].buffer);
    expect(pcm.length).toBe(1600); expect(pcm[0]).toBeCloseTo(16384, 0);
    expect(packets[0].level).toBeCloseTo(0.5);
  });
});
