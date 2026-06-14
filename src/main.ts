import { waitForEvenAppBridge, OsEventTypeList, EventSourceType } from "@evenrealities/even_hub_sdk";
import { createDisplay } from "./glassesui/glasses";
import { createWebUI, type WebUI } from "./webui/webui";
import { connectSc } from "./services/scService";
import { hasApiKey, setApiKey, transcribe } from "./utils/transcribeUtils";
import { VadController } from "./utils/vadUtils";
import { trailingPrompt, stripTrailingPrompt } from "./utils/textUtils";
import { msg } from "./i18n";

// The glasses mic streams single-channel 16 kHz / 16-bit PCM.
const SAMPLE_RATE = 16000;

// Keep the terminal buffer bounded; the glasses only show the tail anyway.
const TERMINAL_MAX = 4000;

// The web view keeps the full conversation history, so it gets a larger buffer.
const WEB_LOG_MAX = 100000;

async function main() {
  const bridge = await waitForEvenAppBridge();
  const display = await createDisplay(bridge);

  // The glasses show only the current exchange (`terminal`), while the web view
  // keeps the full scrollback (`webLog`). Both are fed from the same output.
  let terminal = "";
  let webLog = "";
  let statusText = "";
  let sttLanguage = ""; // ISO-639-1 hint from Settings; "" = auto-detect.

  // The CLI prompt (e.g. "gpt-5.5> ") captured from the last reply, so we can keep
  // it on screen when we clear for a new conversation.
  let lastPrompt = "";

  let generating = false;
  let listening = false;
  let transcriptionEnabled = true;

  // Set to true on reset so that stale in-flight chunks from the previous
  // generation are discarded until the server's :reset reply arrives.
  let discardChunks = false;

  let draft = "";

  // Assigned once createWebUI resolves. Declared up front (and accessed with `?.`)
  // because callbacks passed to createWebUI — e.g. onApiKeyChange — can fire during
  // its setup, before this is assigned; the glasses still render in the meantime.
  let ui: WebUI | undefined;

  // Assigned after createWebUI (same pattern as `ui`). Declared here so stopListening
  // and the audio event handler can reference it without a forward-declaration error.
  let vad!: VadController;

  function renderAll() {
    const preview = draft && !generating;
    const webView = preview ? stripTrailingPrompt(webLog) + `${lastPrompt}${draft}` : webLog;
    // On the glasses: show the in-progress draft while typing, the raw stream while
    // generating, and otherwise the conversation with the waiting prompt (e.g.
    // "gpt-5.5>") pinned at the end. The prompt is stripped from `terminal` once the CLI
    // is idle, so re-add it here — this also shows the model name before the first
    // exchange, when `terminal` is still empty.
    let glassesView: string;
    if (preview) glassesView = terminal ? `${terminal}${lastPrompt}${draft}` : `${lastPrompt}${draft}`;
    else if (generating) glassesView = terminal;
    else glassesView = terminal ? `${terminal}${lastPrompt}` : lastPrompt;
    const cursorOn = !generating;
    ui?.setCursor(cursorOn);
    display.setCursor(cursorOn);
    ui?.render(webView);
    // `webLog` is the full session transcript; hand it over as the scrollback the
    // touch bar pages through while `glassesView` is the live view.
    void display.render({ status: statusText, text: glassesView, history: webLog });
  }

  function emit(text: string) {
    terminal = (terminal + text).slice(-TERMINAL_MAX);
    webLog = (webLog + text).slice(-WEB_LOG_MAX);
    renderAll();
  }

  function setStatus(text: string) {
    statusText = text;
    ui?.setStatus(text);
    renderAll();
  }

  async function startListening() {
    if (!transcriptionEnabled) return;
    if (!hasApiKey()) {
      listening = false;
      setStatus("");
      return;
    }
    const ok = await bridge.audioControl(true);
    if (!transcriptionEnabled) return; // disabled while waiting for audioControl
    listening = ok;
    setStatus(ok ? "● listening" : "⚠ mic failed");
  }

  async function stopListening() {
    listening = false;
    vad.reset();
    setStatus("");
    await bridge.audioControl(false);
  }

  // Auto-login is deferred until the CLI is ready: a login sent before the `sc`
  // process has started and printed its first prompt is lost, so we hold the saved
  // credentials here and send them on the first `onReady` (when "gpt-5.5>" shows).
  let scReady = false;
  let pendingLogin: { username: string; password: string } | null = null;

  const sc = connectSc({
    onChunk: (text) => {
      if (!discardChunks) emit(text);
    },
    onReady: () => {
      const wasDiscarding = discardChunks;
      discardChunks = false;
      if (!scReady) scReady = true;
      // The CLI is idle, having just printed its prompt. Remember it (so a cleared
      // screen still shows it), then drop it from the glasses buffer — this is the
      // one moment we know the trailing `>` is the prompt and not part of a reply
      // (e.g. code like `x -> `), so it's safe to strip without a render-time guard.
      const prompt = trailingPrompt(terminal);
      if (prompt) {
        lastPrompt = prompt;
        terminal = stripTrailingPrompt(terminal);
        renderAll();
      }
      if (generating) {
        generating = false;
        if (wasDiscarding) {
          // The reset discarded the server's reply (including the new prompt).
          // Manually append lastPrompt to webLog so the web UI shows it.
          webLog = (webLog + lastPrompt).slice(-WEB_LOG_MAX);
        }
        renderAll(); // show cursor immediately, regardless of whether listening starts
        void startListening();
      }
      // Flush any queued login AFTER the prompt is rendered, so echoLogin sees the
      // correct lastPrompt and the "gpt-5.5>" line appears before the :login echo.
      if (pendingLogin) {
        echoLogin(pendingLogin.username, pendingLogin.password);
        void sc.login(pendingLogin.username, pendingLogin.password);
        pendingLogin = null;
      }
    },
    onUnavailable: () => emit("\n[sc bridge unavailable — run `npm run dev`]\n"),
  });

  function ask(text: string) {
    draft = "";
    display.followLive();
    terminal = (terminal + `${lastPrompt}${text}\n`).slice(-TERMINAL_MAX);
    // Strip any trailing prompt and re-add `lastPrompt` explicitly — the previous reply
    // usually leaves the prompt at the tail, but not always (e.g. the very first input).
    const stripped = stripTrailingPrompt(webLog);
    webLog = (stripped + `${lastPrompt}${text}\n`).slice(-WEB_LOG_MAX);
    generating = true;
    void stopListening(); // clears the status; set "generating" after so it wins
    setStatus("");
    void sc.send(text);
  }

  function echoLogin(username: string, password: string) {
    const masked = "*".repeat(password.length);
    const line = `:login ${username} ${masked}\n`;
    display.followLive();
    terminal = (terminal + `${lastPrompt}${line}`).slice(-TERMINAL_MAX);
    const stripped = stripTrailingPrompt(webLog);
    webLog = (stripped + `${lastPrompt}${line}`).slice(-WEB_LOG_MAX);
    generating = true;
    void stopListening();
    setStatus("");
  }

  function echoRegister(username: string, email: string, password: string) {
    const masked = "*".repeat(password.length);
    const line = `:user add ${username} ${email} ${masked}\n`;
    display.followLive();
    terminal = (terminal + `${lastPrompt}${line}`).slice(-TERMINAL_MAX);
    const stripped = stripTrailingPrompt(webLog);
    webLog = (stripped + `${lastPrompt}${line}`).slice(-WEB_LOG_MAX);
    generating = true;
    void stopListening();
    setStatus("");
  }

  function reset() {
    draft = "";
    terminal = "";
    webLog = "";
    display.followLive();
    generating = true; // suppress lastPrompt appending until onReady fires
    discardChunks = true; // drop in-flight chunks from the previous generation
    void stopListening();
    setStatus("");
    emit(":help for help\n\n");
    void sc.send(":reset");
  }

  ui = await createWebUI(bridge, {
    onSubmit: (text) => ask(text),
    onRefresh: () => reset(),
    onInput: (text) => {
      draft = text;
      if (text) display.followLive();
      // Typing takes over from the mic: stop on the first keystroke so a typed
      // message isn't competing with captured speech. Resume when input is cleared.
      if (text && listening) void stopListening();
      else if (!text && !listening && !generating) void startListening();
      renderAll();
    },
    // Manual login (button) goes through immediately — the CLI is already idle by
    // then. Startup auto-login fires before the CLI is ready, so it's queued and
    // sent on the first onReady above.
    onLogin: (username, password) => {
      if (scReady) {
        echoLogin(username, password);
        void sc.login(username, password);
      } else {
        pendingLogin = { username, password };
      }
    },
    onRegister: (username, email, password) => {
      echoRegister(username, email, password);
      void sc.send(`:user add ${username} ${email} ${password}`);
    },
    onLanguageChange: (language) => {
      sttLanguage = language;
    },
    onApiKeyChange: (apiKey) => {
      setApiKey(apiKey);
      // The mic follows the key: start when present (also on startup), stop when removed.
      if (apiKey) void startListening();
      else void stopListening();
    },
    onCursorBlinkChange: (blink) => {
      display.setCursorBlink(blink);
    },
    onTranscriptionChange: (enabled) => {
      transcriptionEnabled = enabled;
      if (enabled) void startListening();
      else void stopListening();
    },
  });

  if (!hasApiKey()) {
    setStatus("");
    ui?.toast(msg("noApiKey"), 5000);
  }

  vad = new VadController({
    sampleRate: SAMPLE_RATE,
    onSubmit: (text) => ask(text),
    onStatus: (text) => setStatus(text),
    onPauseMic: () => {
      // Utterance is done — pause the mic but preserve in-flight transcriptions.
      listening = false;
      void bridge.audioControl(false);
    },
    getListening: () => listening,
    isGenerating: () => generating,
    onResumeMic: () => startListening(),
    transcribePcm: (pcm, sampleRate, language) => transcribe(pcm, sampleRate, language),
    getLanguage: () => sttLanguage,
  });

  async function requestExit() {
    await bridge.shutDownPageContainer(1); // 1 = show the "exit?" interaction layer
  }

  async function shutdown() {
    await stopListening();
    await bridge.shutDownPageContainer(0); // 0 = exit immediately (post-confirmation cleanup)
  }

  // Touch-bar scrolls page through the session transcript; single-tap resets the
  // conversation; double-tap raises the exit dialog; system events tear down cleanly.
  bridge.onEvenHubEvent((event) => {
    const eventType = event.textEvent?.eventType ?? event.listEvent?.eventType ?? event.sysEvent?.eventType;
    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      void display.showPreviousView();
      return;
    }
    if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      void display.showNextView();
      return;
    }
    // Single-tap arrives as a sysEvent with only an `eventSource` and no `eventType`
    // — the host doesn't emit CLICK_EVENT for it.
    const eventSource = event.sysEvent?.eventSource;
    if (eventType == null && eventSource != null && eventSource !== EventSourceType.TOUCH_EVENT_FORM_DUMMY_NULL) {
      reset();
      return;
    }
    // Double-tap raises the exit dialog; it does NOT exit directly — the user
    // confirms there, then SYSTEM_EXIT_EVENT drives the actual teardown.
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void requestExit();
      return;
    }
    if (eventType === OsEventTypeList.SYSTEM_EXIT_EVENT || eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      void shutdown();
      return;
    }
    if (!listening) return;
    const pcm = event.audioEvent?.audioPcm;
    if (pcm && pcm.byteLength > 0) vad.push(pcm);
  });

  // Listening is driven by onApiKeyChange (fired with the saved key while
  // createWebUI ran above): it starts the mic when a key is present and stops it
  // otherwise — so with no API key we never start listening.
}

main().catch(console.error);
