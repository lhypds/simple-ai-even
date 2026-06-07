// Glasses display: a full-screen text container that mirrors the web terminal, plus
// a small status container pinned to the bottom-right corner.
// We push the entire output buffer as the main container's content so the device
// shows a native scroll bar and the user can scroll through it with the glasses
// controls. The status (e.g. "● listening") lives in its own corner container so it
// stays put instead of scrolling with the conversation.
// createStartUpPageContainer may only be called once, so this sets both up and then
// pushes every later update through textContainerUpgrade.

import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";

const MAIN_ID = 1;
const MAIN_NAME = "caption"; // max 16 chars
const STATUS_ID = 2;
const STATUS_NAME = "status"; // max 16 chars
const SCREEN_WIDTH = 576;
const SCREEN_HEIGHT = 288;

// A big rounded border framing the whole view. The container is inset by the
// border width on every side so the stroke stays fully on-screen, and padding
// is widened so text never touches the border.
const BORDER_WIDTH = 1;
const BORDER_RADIUS = 28;
const BORDER_COLOR = 5;
const PADDING = 12;

// The status chip sits in the bottom-right corner, inset from the border. It's sized
// generously so the longest status ("● transcribing") never clips; the text is
// left-aligned within it (the device has no text-align option) but the box itself is
// anchored to the bottom-right so the status reads as a corner indicator.
const STATUS_WIDTH = 144;
const STATUS_HEIGHT = 36;
const STATUS_MARGIN = 10;

export interface Display {
  render(state: { status: string; text: string }): Promise<void>;
}

export async function createDisplay(bridge: EvenAppBridge): Promise<Display> {
  const main = new TextContainerProperty({
    xPosition: BORDER_WIDTH,
    yPosition: BORDER_WIDTH,
    width: SCREEN_WIDTH - BORDER_WIDTH * 2,
    height: SCREEN_HEIGHT - BORDER_WIDTH * 2,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderRadius: BORDER_RADIUS,
    paddingLength: PADDING,
    containerID: MAIN_ID,
    containerName: MAIN_NAME,
    content: "",
    isEventCapture: 1, // let the container capture the device's scroll controls
  });

  const status = new TextContainerProperty({
    xPosition: SCREEN_WIDTH - STATUS_WIDTH - STATUS_MARGIN,
    yPosition: SCREEN_HEIGHT - STATUS_HEIGHT - STATUS_MARGIN,
    width: STATUS_WIDTH,
    height: STATUS_HEIGHT,
    paddingLength: 4,
    containerID: STATUS_ID,
    containerName: STATUS_NAME,
    content: "",
    isEventCapture: 0,
  });

  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [main, status] }),
  );
  if (result !== 0) throw new Error(`createStartUpPageContainer failed: ${result}`);

  function upgrade(containerID: number, containerName: string, content: string) {
    return bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID,
        containerName,
        contentOffset: 0,
        contentLength: content.length,
        content,
      }),
    );
  }

  return {
    async render({ status, text }) {
      // Main container holds the conversation; the status sits in its own corner box.
      // Trim trailing newlines so the conversation doesn't leave a dangling blank line
      // above the corner status.
      await Promise.all([upgrade(MAIN_ID, MAIN_NAME, text.replace(/\n+$/, "")), upgrade(STATUS_ID, STATUS_NAME, status)]);
    },
  };
}
