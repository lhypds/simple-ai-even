// Text helpers for the terminal-style views (web + glasses): trimming output to a
// screenful and parsing the CLI's trailing prompt.

// Keep the last `maxRows` wrapped rows of `text`, dropping whole lines from the top.
// If the bottom-most line alone overflows, keep just its trailing screenful of chars.
// `charsPerLine` is how many characters fit on one wrapped row at the target font.
export function tailRows(text: string, maxRows: number, charsPerLine: number): string {
  if (maxRows < 1) maxRows = 1;
  const wrapped = (line: string) => Math.max(1, Math.ceil(line.length / charsPerLine));
  const lines = text.split("\n");
  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const rows = wrapped(lines[i]);
    if (used + rows > maxRows) {
      if (kept.length === 0) kept.unshift(lines[i].slice(-maxRows * charsPerLine));
      break;
    }
    used += rows;
    kept.unshift(lines[i]);
  }
  return kept.join("\n");
}

// Extract the trailing CLI prompt (e.g. "gpt-5.5> ") from the output, if any.
export function trailingPrompt(text: string): string {
  const m = text.match(/(?:^|\n)([^\n]*?>[ \t]*)$/);
  return m ? m[1] : "";
}

// Drop a trailing CLI prompt line (e.g. "gpt-5.5> ") from the output, keeping any
// leading newline. Used before re-adding the prompt so it's never duplicated.
export function stripTrailingPrompt(text: string): string {
  return text.replace(/(^|\n)[^\n]*?>[ \t]*$/, "$1");
}
