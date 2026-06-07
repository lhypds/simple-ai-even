import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createDisplay } from "./glasses";
import { createWebUI } from "./ui";
import { SpeechSegmenter } from "./segmenter";
import { hasApiKey, transcribe } from "./transcribe";

// The glasses mic streams single-channel 16 kHz / 16-bit PCM.
const SAMPLE_RATE = 16000;

async function main() {
  const bridge = await waitForEvenAppBridge();
  const ui = await createWebUI(bridge);
  const display = await createDisplay(bridge);

  if (!hasApiKey()) {
    const msg = "Set VITE_OPENAI_API_KEY in .env and rebuild.";
    ui.setStatus("⚠ No API key");
    await display.render({ status: "⚠ No API key", text: msg });
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
    ui.setStatus("● transcribing…");
    await display.render({ status: "● transcribing…", text: transcript });
    try {
      const text = await transcribe(pcm, SAMPLE_RATE);
      if (text && seq > lastShownSeq) {
        lastShownSeq = seq;
        transcript = transcript ? `${transcript} ${text}` : text;
        ui.addTranscript(text); // show the finished result on the page
        ui.askSc(text); // and send it to the sc AI chat
      }
    } catch (err) {
      console.error("transcribe error:", err);
    }
    ui.setStatus("● listening");
    await display.render({ status: "● listening", text: transcript });
  }

  // Audio arrives as audioEvent PCM bytes on the EvenHub event stream.
  bridge.onEvenHubEvent((event) => {
    const pcm = event.audioEvent?.audioPcm;
    if (pcm && pcm.byteLength > 0) segmenter.push(pcm);
  });

  const micOpen = await bridge.audioControl(true);
  const status = micOpen ? "● listening" : "⚠ mic failed";
  ui.setStatus(status);
  await display.render({ status, text: transcript });
}

main().catch(console.error);
