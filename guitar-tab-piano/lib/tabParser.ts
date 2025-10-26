// Shared tab parsing and MIDI helpers extracted from convert page.
// Supports fixed-width encoding and legacy variable-width ASCII tabs.

export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
export const A0_MIDI = 21; // Lowest piano key MIDI
export const C8_MIDI = 108; // Highest typical piano key MIDI

// Standard tuning high → low: e4 B3 G3 D3 A2 E2
export const STRING_OPEN_MIDI: Record<string, number> = {
  e: 64,
  B: 59,
  G: 55,
  D: 50,
  A: 45,
  E: 40,
};

export interface ParsedNote {
  string: string; // string name e B G D A E
  fret: number;   // 0-24
  midi: number;   // MIDI value
  key: number;    // Piano key number (1-88)
  name: string;   // Note name (e.g., C#4)
}

export interface TabEvent {
  step: number; // timeline column index (0-based)
  notes: ParsedNote[]; // chord notes at this step
}

export interface ParseResult {
  events: TabEvent[];
  steps: number; // total logical steps
}

export function midiToKeyNumber(midi: number) {
  return midi - 20; // A0(21) -> 1
}

export function midiToName(midi: number) {
  const pitch = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitch]}${octave}`;
}

// Black key detection (for piano rendering; may be unused by guitar page)
export function isBlackKey(midi: number) {
  return [1,3,6,8,10].includes(midi % 12);
}

// Main parser previously inline in convert/page.tsx
export function parseAsciiTab(tabText: string): ParseResult {
  const lines = tabText.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
  const candidates: string[] = [];
  for (const line of lines) {
    const pipeIdx = line.indexOf("|");
    const body = pipeIdx >= 0 ? line.slice(pipeIdx + 1) : line;
    if (/^[\-\d\s|hHpP/\\~()*xX<>]+$/.test(body)) {
      candidates.push(line);
    }
  }
  let tabLines: string[] = [];
  if (candidates.length >= 6) {
    for (let i = 0; i <= candidates.length - 6; i++) {
      const chunk = candidates.slice(i, i + 6);
      if (/^\s*[eE]/.test(chunk[0]) && /^\s*[B]/.test(chunk[1])) { tabLines = chunk; break; }
    }
    if (tabLines.length === 0) tabLines = candidates.slice(0,6);
  } else {
    tabLines = lines.slice(0,6);
  }
  if (tabLines.length < 6) throw new Error("Need 6 tab lines (e, B, G, D, A, E). Paste a standard ASCII guitar tab.");

  const firstLineContent = tabLines[0].slice(tabLines[0].indexOf("|") + 1);
  const isNewSectionedFormat = (firstLineContent.match(/\|/g) || []).length > 0;
  let maxLen = 0;
  let padded: string[] = [];

  if (isNewSectionedFormat) {
    const sections: string[][] = [];
    tabLines.forEach(line => {
      const parts = line.split('|').slice(1);
      while (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
      sections.push(parts);
    });
    const flattened = sections.map(stringSections => stringSections.join(''));
    maxLen = Math.max(...flattened.map(l => l.length));
    padded = flattened.map(l => l.padEnd(maxLen, "-"));
  } else {
    const cleaned = tabLines.map(l => {
      const idx = l.indexOf("|");
      let body = (idx >= 0 ? l.slice(idx + 1) : l).replace(/\s+/g, "");
      body = body.replace(/\|+$/, '');
      return body;
    });
    maxLen = Math.max(...cleaned.map(l => l.length));
    padded = cleaned.map(l => l.padEnd(maxLen, "-"));
  }

  const order = ["e","B","G","D","A","E"] as const;
  const isFixedWidth = padded.every(line => line.length % 2 === 0 && (() => {
    for (let i = 0; i < line.length; i += 2) {
      const pair = line.slice(i, i + 2);
      if (!/^--|\d-|\d\d$/.test(pair)) return false;
    }
    return true;
  })());

  const events: TabEvent[] = [];
  if (isFixedWidth) {
    const logicalSteps = maxLen / 2;
    for (let step = 0; step < logicalSteps; step++) {
      const notesAtCol: ParsedNote[] = [];
      const charIndex = step * 2;
      for (let r = 0; r < 6; r++) {
        const pair = padded[r].slice(charIndex, charIndex + 2);
        let fret: number | null = null;
        if (/^\d-$/.test(pair)) fret = parseInt(pair[0], 10);
        else if (/^\d\d$/.test(pair)) fret = parseInt(pair, 10);
        if (fret !== null && fret <= 24) {
          const stringName = order[r];
          const openMidi = STRING_OPEN_MIDI[stringName];
          const midi = openMidi + fret;
          if (midi >= A0_MIDI && midi <= C8_MIDI) {
            const key = midiToKeyNumber(midi);
            notesAtCol.push({ string: stringName, fret, midi, key, name: midiToName(midi) });
          }
        }
      }
      events.push({ step, notes: notesAtCol });
    }
    return { events, steps: logicalSteps };
  }

  // Legacy variable-width parsing
  const grid = padded.map(l => l.split(""));
  for (let col = 0; col < maxLen; col++) {
    const notesAtCol: ParsedNote[] = [];
    for (let r = 0; r < 6; r++) {
      const ch = grid[r][col];
      if (/\d/.test(ch)) {
        let numStr = ch;
        let advance = 0;
        if (col + 1 < maxLen && /\d/.test(grid[r][col + 1])) { numStr += grid[r][col + 1]; advance++; }
        if (col + 2 < maxLen && /\d/.test(grid[r][col + 2])) { numStr += grid[r][col + 2]; advance++; }
        let fret = parseInt(numStr, 10);
        if (fret > 24) fret = 24;
        const stringName = order[r];
        const openMidi = STRING_OPEN_MIDI[stringName];
        const midi = openMidi + fret;
        if (midi >= A0_MIDI && midi <= C8_MIDI) {
          const key = midiToKeyNumber(midi);
          notesAtCol.push({ string: stringName, fret, midi, key, name: midiToName(midi) });
        }
        for (let k = 1; k <= advance; k++) grid[r][col + k] = '-';
      }
    }
    events.push({ step: col, notes: notesAtCol });
  }
  return { events, steps: maxLen };
}
