// Glasses display: one full-screen text container that shows a status line plus a
// rolling transcript. createStartUpPageContainer may only be called once, so this
// sets it up and then pushes every later update through textContainerUpgrade.

import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";

const CONTAINER_ID = 1;
const CONTAINER_NAME = "caption"; // max 16 chars
const SCREEN_WIDTH = 576;
const SCREEN_HEIGHT = 288;

// How much transcript tail to keep on screen. The display is small (576x288), so we
// trim to the most recent characters at a word boundary.
const MAX_TRANSCRIPT_CHARS = 360;

export interface Display {
  render(state: { status: string; text: string }): Promise<void>;
}

export async function createDisplay(bridge: EvenAppBridge): Promise<Display> {
  const main = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: CONTAINER_ID,
    containerName: CONTAINER_NAME,
    content: "Starting…",
    isEventCapture: 1,
  });

  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [main] }),
  );
  if (result !== 0) throw new Error(`createStartUpPageContainer failed: ${result}`);

  return {
    async render({ status, text }) {
      const tail = trimTail(text, MAX_TRANSCRIPT_CHARS);
      const content = status ? `${status}\n${tail}` : tail;
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID,
          containerName: CONTAINER_NAME,
          contentOffset: 0,
          contentLength: content.length,
          content,
        }),
      );
    },
  };
}

function trimTail(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(text.length - max);
  const space = cut.indexOf(" ");
  return space > 0 ? cut.slice(space + 1) : cut;
}
