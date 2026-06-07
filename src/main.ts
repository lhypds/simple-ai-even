import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createDisplay } from "./glasses";
import { SpeechSegmenter } from "./segmenter";
import { hasApiKey, transcribe } from "./transcribe";

// The glasses mic streams single-channel 16 kHz / 16-bit PCM.
const SAMPLE_RATE = 16000;

async function main() {
  const bridge = await waitForEvenAppBridge();
  const display = await createDisplay(bridge);

  if (!hasApiKey()) {
    await display.render({
      status: "⚠ No API key",
      text: "Set VITE_OPENAI_API_KEY in .env and rebuild.",
    });
    return;
  }

  let transcript = "";

  // Each closed segment is sent off for transcription. We tag segments so a slow
  // response can't append out of order.
  let nextSeq = 0;
  let lastShownSeq = -1;

  const segmenter = new SpeechSegmenter({
    sampleRate: SAMPLE_RATE,
    onSegment: (pcm) => {
      const seq = nextSeq++;
      void handleSegment(pcm, seq);
    },
  });

  async function handleSegment(pcm: Uint8Array, seq: number) {
    await display.render({ status: "● transcribing…", text: transcript });
    try {
      const text = await transcribe(pcm, SAMPLE_RATE);
      if (text && seq > lastShownSeq) {
        lastShownSeq = seq;
        transcript = transcript ? `${transcript} ${text}` : text;
      }
    } catch (err) {
      console.error("transcribe error:", err);
    }
    await display.render({ status: "● listening", text: transcript });
  }

  // Audio arrives as audioEvent PCM bytes on the EvenHub event stream.
  bridge.onEvenHubEvent((event) => {
    const pcm = event.audioEvent?.audioPcm;
    if (pcm && pcm.byteLength > 0) segmenter.push(pcm);
  });

  const micOpen = await bridge.audioControl(true);
  await display.render({
    status: micOpen ? "● listening" : "⚠ mic failed",
    text: transcript,
  });
}

main().catch(console.error);
