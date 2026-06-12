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

// Break text into the visual rows the glasses draw: hard newlines split rows, and a
// line longer than `charsPerLine` wraps onto consecutive rows. Used to estimate row
// counts — the firmware applies the same character-boundary wrapping when it renders.
export function visualRows(text: string, charsPerLine: number): string[] {
  const rows: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= charsPerLine) {
      rows.push(line);
      continue;
    }
    for (let i = 0; i < line.length; i += charsPerLine) rows.push(line.slice(i, i + charsPerLine));
  }
  return rows;
}

// Group the lines of `text` into screenfuls, each holding at most `maxRows` visual rows.
// Pages are returned oldest-first. Long lines that would leave a page half-empty are
// split at word boundaries to fill the page; the remainder continues on the next page.
// This keeps pages full and ensures no word is split across a page turn.
export function buildPages(text: string, charsPerLine: number, maxRows: number): string[][] {
  const rowCount = (s: string) => Math.max(1, Math.ceil(s.length / charsPerLine));
  const pages: string[][] = [];
  let current: string[] = [];
  let used = 0;

  for (const origLine of text.split("\n")) {
    let seg = origLine;
    // A single original line may be split across multiple pages if it is very long.
    while (true) {
      const rows = rowCount(seg);
      if (used + rows <= maxRows) {
        current.push(seg);
        used += rows;
        break;
      }
      // seg doesn't fit whole. Fill the remaining rows on the current page with a
      // word-boundary prefix, then continue with the rest on a new page.
      const rowsLeft = maxRows - used;
      if (rowsLeft > 0) {
        const maxChars = rowsLeft * charsPerLine;
        if (seg.length <= maxChars) {
          // Fits in rowsLeft rows (ceil check passes) — add whole and close page.
          current.push(seg);
          used += rows;
          break;
        }
        const sp = seg.lastIndexOf(" ", maxChars);
        const cut = sp > 0 ? sp : maxChars; // fall back to hard break (e.g. URLs, CJK)
        current.push(seg.slice(0, cut));
        seg = seg.slice(cut + (seg[cut] === " " ? 1 : 0));
      }
      // Commit the current page and start a fresh one.
      if (current.length > 0) { pages.push(current); current = []; used = 0; }
      if (seg.length === 0) break;
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
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
