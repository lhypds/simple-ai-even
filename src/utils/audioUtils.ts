// Audio helpers for the glasses mic stream: 16-bit little-endian mono PCM.

const BYTES_PER_SAMPLE = 2; // 16-bit
const NUM_CHANNELS = 1; // mono

// Root-mean-square amplitude of a PCM buffer (on the 0..32767 scale), used to tell
// speech from silence.
export function rms(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.floor(bytes.byteLength / BYTES_PER_SAMPLE);
  if (count === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < count; i++) {
    const sample = view.getInt16(i * BYTES_PER_SAMPLE, true);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / count);
}

// Concatenate PCM chunks into a single buffer of the given total length.
export function concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// Wrap raw 16-bit little-endian mono PCM (as delivered by the glasses mic) in a
// minimal WAV container so it can be POSTed to a REST transcription endpoint.
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Blob {
  const blockAlign = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true); // file size - 8
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}
