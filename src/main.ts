import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createDisplay } from "./glasses";
import { createWebUI } from "./ui";
import { connectSc } from "./sc";
import { SpeechSegmenter } from "./segmenter";
import { hasApiKey, transcribe } from "./transcribe";

// The glasses mic streams single-channel 16 kHz / 16-bit PCM.
const SAMPLE_RATE = 16000;

// Keep the terminal buffer bounded; the glasses only show the tail anyway.
const TERMINAL_MAX = 4000;

async function main() {
  const bridge = await waitForEvenAppBridge();
  const display = await createDisplay(bridge);

  // One terminal buffer drives both the web view and the glasses, so they show
  // exactly the same text.
  let terminal = "";
  let statusText = "starting…";
  let sttLanguage = ""; // ISO-639-1 hint from Settings; "" = auto-detect.

  function emit(text: string) {
    terminal = (terminal + text).slice(-TERMINAL_MAX);
    ui.render(terminal);
    void display.render({ status: statusText, text: terminal });
  }

  function setStatus(text: string) {
    statusText = text;
    ui.setStatus(text);
    void display.render({ status: statusText, text: terminal });
  }

  // The `sc` CLI bridge: stream its output into the terminal as it arrives.
  const sc = connectSc({
    onChunk: (text) => emit(text),
    onReady: () => {},
    onUnavailable: () => emit("\n[sc bridge unavailable — run `npm run dev`]\n"),
  });

  // Echo the input so it appears right after the `gpt-5.5>` prompt the CLI already
  // printed (a piped stdin isn't echoed back), then send it to `sc`.
  function ask(text: string) {
    emit(`${text}\n`);
    void sc.send(text);
  }

  const ui = await createWebUI(bridge, {
    onSubmit: (text) => ask(text),
    onLogin: (username, password) => void sc.login(username, password),
    onLanguageChange: (language) => {
      sttLanguage = language;
    },
  });

  if (!hasApiKey()) {
    setStatus("⚠ No API key");
    emit("Set VITE_OPENAI_API_KEY in .env and rebuild.\n");
    return;
  }

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
    setStatus("● transcribing…");
    try {
      const text = await transcribe(pcm, SAMPLE_RATE, sttLanguage || undefined);
      if (text && seq > lastShownSeq) {
        lastShownSeq = seq;
        ask(text); // echo the transcript and forward it to sc
      }
    } catch (err) {
      console.error("transcribe error:", err);
    }
    setStatus("● listening");
  }

  // Audio arrives as audioEvent PCM bytes on the EvenHub event stream.
  bridge.onEvenHubEvent((event) => {
    const pcm = event.audioEvent?.audioPcm;
    if (pcm && pcm.byteLength > 0) segmenter.push(pcm);
  });

  const micOpen = await bridge.audioControl(true);
  setStatus(micOpen ? "● listening" : "⚠ mic failed");
}

main().catch(console.error);
