import { SpeechSegmenter } from "./speechUtils";

export interface VadControllerOptions {
  sampleRate: number;
  /** Called with assembled transcription text when an utterance is ready to submit. */
  onSubmit: (text: string) => void;
  /** Called to update the UI status string. */
  onStatus: (status: string) => void;
  /** Pause the mic without clearing in-flight transcriptions (called on utterance end). */
  onPauseMic: () => void;
  /** Returns true while the mic is open and accepting audio. */
  getListening: () => boolean;
  /** Returns true while the AI is generating a reply. */
  isGenerating: () => boolean;
  /** Resume listening after a silent utterance produced nothing to submit. */
  onResumeMic: () => Promise<void>;
  transcribePcm: (pcm: Uint8Array, sampleRate: number, language?: string) => Promise<string>;
  getLanguage: () => string;
}

export class VadController {
  private nextSeq = 0;
  private pendingCount = 0;
  private utteranceDone = false;
  private readonly pendingSegments = new Map<number, string>();
  private readonly segmenter: SpeechSegmenter;
  private readonly opts: VadControllerOptions;

  constructor(opts: VadControllerOptions) {
    this.opts = opts;
    this.segmenter = new SpeechSegmenter({
      sampleRate: opts.sampleRate,
      onSegment: (pcm) => {
        const seq = this.nextSeq++;
        this.pendingCount++;
        void this.handleSegment(pcm, seq);
      },
      onUtteranceEnd: () => {
        opts.onPauseMic();
        this.utteranceDone = true;
        this.trySubmit();
      },
    });
  }

  push(chunk: Uint8Array): void {
    this.segmenter.push(chunk);
  }

  /** Discard accumulated state — call from stopListening. */
  reset(): void {
    this.utteranceDone = false;
    this.pendingSegments.clear();
  }

  private trySubmit(): void {
    if (this.pendingCount > 0) return;
    if (!this.utteranceDone) return;
    this.utteranceDone = false;
    if (this.pendingSegments.size > 0) {
      const combined = [...this.pendingSegments.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, t]) => t)
        .join(" ");
      this.pendingSegments.clear();
      this.opts.onSubmit(combined);
      return;
    }
    // Nothing to submit (silence / unintelligible audio) — resume listening
    // unless the AI is already generating a response.
    if (!this.opts.isGenerating()) void this.opts.onResumeMic();
  }

  private async handleSegment(pcm: Uint8Array, seq: number): Promise<void> {
    if (!this.opts.getListening()) {
      this.pendingCount--;
      return;
    }

    this.opts.onStatus("● transcribing");
    try {
      const lang = this.opts.getLanguage();
      const text = await this.opts.transcribePcm(pcm, this.opts.sampleRate, lang || undefined);
      if (!this.opts.getListening() && !this.utteranceDone) {
        // Full stop (e.g. user started typing): discard. But if utteranceDone is
        // true we only paused the mic — let this transcription complete and submit.
        this.pendingCount--;
        if (this.pendingCount === 0) this.pendingSegments.clear();
        return;
      }
      if (text) this.pendingSegments.set(seq, text);
    } catch (err) {
      console.error("transcribe error:", err);
    }

    this.pendingCount--;
    this.trySubmit();
  }
}
