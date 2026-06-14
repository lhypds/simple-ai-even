// Audio helpers for the glasses mic stream: 16-bit little-endian mono PCM.

const BYTES_PER_SAMPLE = 2; // 16-bit
const NUM_CHANNELS = 1; // mono

// Convert 16-bit LE PCM to normalized Float32 in [-1, 1].
export function int16ToFloat32(buf: Uint8Array): Float32Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = Math.floor(buf.byteLength / BYTES_PER_SAMPLE);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * BYTES_PER_SAMPLE, true) / 32768;
  }
  return out;
}

// Convert normalized Float32 [-1, 1] back to 16-bit LE PCM.
export function float32ToInt16(f32: Float32Array): Uint8Array {
  const out = new Uint8Array(f32.length * BYTES_PER_SAMPLE);
  const view = new DataView(out.buffer);
  for (let i = 0; i < f32.length; i++) {
    view.setInt16(
      i * BYTES_PER_SAMPLE,
      Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768))),
      true,
    );
  }
  return out;
}

// Wrap raw 16-bit LE mono PCM in a minimal WAV container so it can be POSTed
// to a REST transcription endpoint.
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Blob {
  const blockAlign = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}
