"use client";
import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import Soundfont from "soundfont-player"; // Install dependency: npm install soundfont-player

/**
 * Guitar Tab → Piano Key Visualizer
 *
 * Paste a standard 6‑line ASCII guitar tab and press "Convert".
 * The app parses columns as time-steps (like 16ths), maps frets to MIDI, then to piano key numbers (1–88).
 * You can play it back to see highlighted keys on a full 88‑key virtual keyboard.
 *
 * Assumptions:
 * - Standard tuning (high→low): e4, B3, G3, D3, A2, E2
 * - Columns are evenly spaced time‑steps
 * - Multi-digit frets (10, 11, 12, …) are supported
 * - Stacked notes at the same column = chord
 * - Non-tab characters (|, -, ~, h, p, /, \\) are ignored for pitch; only numbers form notes
 */

// ---------- Music helpers ----------
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const A0_MIDI = 21; // A0
const C8_MIDI = 108; // highest typical piano key
const PIANO_KEYS = Array.from({ length: 88 }, (_, i) => A0_MIDI + i);

function midiToKeyNumber(midi: number) {
  // Piano key numbering 1–88 where A0 (21) → 1
  return midi - 20;
}

function midiToName(midi: number) {
  const pitch = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI octave convention: C4=60
  return `${NOTE_NAMES[pitch]}${octave}`;
}

function isBlackKey(midi: number) {
  return [1,3,6,8,10].includes(midi % 12);
}

// Guitar standard tuning high→low: e4 B3 G3 D3 A2 E2
const STRING_OPEN_MIDI = {
  e: 64, // E4
  B: 59, // B3
  G: 55, // G3
  D: 50, // D3
  A: 45, // A2
  E: 40, // E2
};

// ---------- Tab Parser ----------
  function parseAsciiTab(tabText: string) {
    // Normalize newlines, trim empty lines
    const lines = tabText.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
    // Find the 6 tab lines in order top→bottom; allow labels like "e|" or "E|"
    // We'll try to detect by starting letters
    const candidates = [] as string[];
    for (const line of lines) {
      // take everything after first '|' if present to reduce noise
      const pipeIdx = line.indexOf("|");
      const body = pipeIdx >= 0 ? line.slice(pipeIdx + 1) : line;
      // keep only lines that look tabby (mostly - digits and symbols)
      if (/^[\-\d\s|hHpP/\\~()*xX<>]+$/.test(body)) {
        candidates.push(line);
      }
    }
    // If user pasted exactly 6 lines, prefer those
    let tabLines: string[] = [];
    if (candidates.length >= 6) {
      // Try to find a window of 6 consecutive lines
      for (let i = 0; i <= candidates.length - 6; i++) {
        const chunk = candidates.slice(i, i + 6);
        // Heuristic: top line starts with 'e' or 'E'
        if (/^\s*[eE]/.test(chunk[0]) && /^\s*[B]/.test(chunk[1])) {
          tabLines = chunk;
          break;
        }
      }
      if (tabLines.length === 0) {
        tabLines = candidates.slice(0,6);
      }
    } else {
      tabLines = lines.slice(0,6);
    }
    if (tabLines.length < 6) throw new Error("Need 6 tab lines (e, B, G, D, A, E). Paste a standard ASCII guitar tab.");

    // Clean to only the part after the first '|' to align columns (keep full if no '|')
    const cleaned = tabLines.map((l) => {
      const idx = l.indexOf("|");
      return (idx >= 0 ? l.slice(idx + 1) : l).replace(/\s+/g, "");
    });

    // Ensure all lines equal length by padding
    const maxLen = Math.max(...cleaned.map((l) => l.length));
    const padded = cleaned.map((l) => l.padEnd(maxLen, "-"));

    // Map lines to string names in order e B G D A E (top→bottom)
    const order = ["e","B","G","D","A","E"] as const;

    // Build a grid of characters [stringIndex][column]
    const grid = padded.map((l) => l.split(""));

    // Scan columns; if a digit, read possibly 2-digit or 3-digit number
    const events: { step: number; notes: { string: string; fret: number; midi: number; key: number; name: string }[] }[] = [];

    for (let col = 0; col < maxLen; col++) {
      const notesAtCol: { string: string; fret: number; midi: number; key: number; name: string }[] = [];

      for (let r = 0; r < 6; r++) {
        const ch = grid[r][col];
        if (/[0-9]/.test(ch)) {
          // peek ahead for multi-digit
          let numStr = ch;
          let advance = 0;
          // Allow up to 2 extra digits (frets like 10, 11, 12, 13, 14, 15, 19, 21, 24)
          if (col + 1 < maxLen && /[0-9]/.test(grid[r][col + 1])) { numStr += grid[r][col + 1]; advance++; }
          if (col + 2 < maxLen && /[0-9]/.test(grid[r][col + 2])) { numStr += grid[r][col + 2]; advance++; }
          const fret = parseInt(numStr, 10);

          // Determine string name from r (row index). r=0 is top line → 'e'
          const stringName = order[r];
          const openMidi = (STRING_OPEN_MIDI as any)[stringName] as number;
          const midi = openMidi + fret;
          if (midi < A0_MIDI || midi > C8_MIDI) {
            // Skip notes outside piano range; guitar rarely exceeds, but bends/very high frets could
          } else {
            const key = midiToKeyNumber(midi);
            notesAtCol.push({ string: stringName, fret, midi, key, name: midiToName(midi) });
          }

          // Mark consumed digits as '-' so they aren't double-read
          for (let k = 1; k <= advance; k++) {
            grid[r][col + k] = "-";
          }
        }
      }

      // Always create an event for each column, even if no notes (for proper timing)
      events.push({ step: col, notes: notesAtCol });
    }

    return { events, steps: maxLen };
  }// ---------- UI Components ----------
function Keyboard({ activeMidis }: { activeMidis: number[] }) {
  // Render 88-key keyboard, highlight activeMidis
  return (
    <div className="relative w-full max-w-5xl mx-auto select-none">
      {/* White keys layer */}
      <div className="flex relative h-36 bg-neutral-200 rounded-xl p-2 gap-0.5 shadow-inner">
        {PIANO_KEYS.map((midi) => (
          <div
            key={`w-${midi}`}
            className={
              "relative flex-1 h-full rounded-md border border-neutral-300 " +
              (isBlackKey(midi) ? "hidden" : "bg-white") +
              (activeMidis.includes(midi) ? " ring-4 ring-blue-400" : "")
            }
            title={`${midiToName(midi)} (MIDI ${midi}) Key ${midiToKeyNumber(midi)}`}
          >
            {/* Optional label for C notes */}
            {midi % 12 === 0 && (
              <div className="absolute bottom-1 left-1 text-[10px] text-neutral-500">
                {midiToName(midi)}
              </div>
            )}
          </div>
        ))}
        {/* Black keys overlay */}
        <div className="absolute inset-2 flex gap-0.5 pointer-events-none">
          {PIANO_KEYS.map((midi, i) => (
            isBlackKey(midi) ? (
              <div
                key={`b-${midi}`}
                className={
                  "relative" + (isBlackKey(midi - 1) ? " w-0" : " flex-1")
                }
              >
                <div
                  className={
                    "absolute h-20 -mt-2 left-1/2 -translate-x-1/2 w-3/5 rounded-md border border-neutral-700 " +
                    (activeMidis.includes(midi) ? "bg-blue-600" : "bg-neutral-900")
                  }
                  title={`${midiToName(midi)} (MIDI ${midi}) Key ${midiToKeyNumber(midi)}`}
                />
              </div>
            ) : (
              <div key={`s-${midi}`} className="flex-1" />
            )
          ))}
        </div>
      </div>
    </div>
  );
}

const CHATGPT_PROMPT = `I have a screenshot of a guitar tab. Please transcribe it into plain 6-line ASCII tab in standard tuning (top to bottom: e| B| G| D| A| E|). Keep columns aligned; use '-' for spacers. Only digits for frets (support multi-digit like 10,11,12 etc.). Remove commentary, section headers, tuning notes, tempo/tempo markings, and decorative characters. Output ONLY the 6 tab lines, no explanations or code fences. Example:
e|----------------|
B|----------------|
G|----------------|
D|----------------|
A|--0--2--3--5----|
E|----------------|`;

export default function GuitarTabToPiano() {
  const [tab, setTab] = useState(`e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|--0--2--3--5----|\nE|----------------|\n`);
  const [events, setEvents] = useState<{ step: number; notes: { string: string; fret: number; midi: number; key: number; name: string }[] }[]>([]);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [bpm, setBpm] = useState(80); // BPM instead of msPerStep
  const timerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null); // added
  const [instrument, setInstrument] = useState<any>(null); // added
  const [isMuted, setIsMuted] = useState(false); // audio mute state

  // Convert BPM to milliseconds per step (assuming 16th notes)
  const msPerStep = useMemo(() => {
    // 60000 ms per minute / BPM = ms per quarter note
    // Divide by 4 for 16th notes
    return (60000 / bpm) / 4;
  }, [bpm]);

  // Enable audio by default on component mount
  React.useEffect(() => {
    const enableAudio = async () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ac = new AudioCtx();
        audioCtxRef.current = ac;
        const inst = await Soundfont.instrument(ac, 'acoustic_grand_piano');
        setInstrument(inst);
      } catch (error) {
        console.warn('Could not initialize audio:', error);
      }
    };
    enableAudio();
  }, []);

  function copyInstructions() {
    navigator.clipboard.writeText(CHATGPT_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const activeMidis = useMemo(() => {
    const e = events.find((ev) => ev.step === cursor);
    return e ? e.notes.map((n) => n.midi) : [];
  }, [cursor, events]);

  function onConvert() {
    try {
      const { events, steps } = parseAsciiTab(tab);
      setEvents(events);
      setCursor(0); // Start at step 0
      setPlaying(false);
    } catch (err: any) {
      alert(err.message || String(err));
    }
  }

  function onPlay() {
    if (!events.length) return;
    setPlaying(true);
    
    // Find the total number of steps from the events
    const totalSteps = Math.max(...events.map(e => e.step)) + 1;
    
    let currentStep = cursor;
    const tick = () => {
      // Find event at current step (if any)
      const ev = events.find(e => e.step === currentStep);
      
      // Play notes if there are any at this step
      if (ev && ev.notes.length > 0 && instrument && audioCtxRef.current && !isMuted) {
        const duration = msPerStep / 1000 * 0.9;
        ev.notes.forEach(n =>
          instrument.play(n.midi, audioCtxRef.current!.currentTime, { duration })
        );
      }
      
      // Update cursor to current step
      setCursor(currentStep);
      
      // Move to next step
      currentStep++;
      
      // Check if we've reached the end
      if (currentStep >= totalSteps) {
        setPlaying(false);
        timerRef.current && window.clearTimeout(timerRef.current);
        timerRef.current = null;
        return;
      }
      
      // Schedule next step
      timerRef.current = window.setTimeout(tick, msPerStep);
    };
    
    timerRef.current = window.setTimeout(tick, 0);
  }

  function onPause() {
    setPlaying(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function onReset() {
    setCursor(0);
    onPause();
  }

  function goToPrevStep() {
    if (!events.length) return;
    // Find the previous step that has notes
    const stepsWithNotes = events.filter(e => e.notes.length > 0).map(e => e.step).sort((a, b) => a - b);
    if (stepsWithNotes.length === 0) return;
    
    // Find the largest step with notes that is less than the current cursor
    const prevStep = stepsWithNotes.reverse().find(step => step < cursor);
    if (prevStep !== undefined) {
      setCursor(prevStep);
    } else {
      // If no previous step found, go to the last step with notes
      const lastStepWithNotes = stepsWithNotes[0]; // stepsWithNotes is now reversed
      if (lastStepWithNotes !== undefined) {
        setCursor(lastStepWithNotes);
      }
    }
  }
  
  function goToNextStep() {
    if (!events.length) return;
    // Find the next step that has notes
    const stepsWithNotes = events.filter(e => e.notes.length > 0).map(e => e.step).sort((a, b) => a - b);
    const nextStep = stepsWithNotes.find(step => step > cursor);
    if (nextStep !== undefined) {
      setCursor(nextStep);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Guitar Tab → Piano Key Visualizer</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Input Tab</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={tab}
              onChange={(e) => setTab(e.target.value)}
              className="w-full h-56 font-mono text-sm p-3 rounded-xl border"
              placeholder={`e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|--0--2--3--5----|\nE|----------------|`}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button onClick={onConvert}>Convert</Button>
              {!playing ? (
                <Button variant="secondary" onClick={onPlay} disabled={!events.length}> <Play className="w-4 h-4 mr-1" />Play</Button>
              ) : (
                <Button variant="secondary" onClick={onPause}> <Pause className="w-4 h-4 mr-1" />Pause</Button>
              )}
              <Button variant="ghost" onClick={onReset}><RotateCcw className="w-4 h-4 mr-1" />Reset</Button>
              <Button variant="outline" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? "🔇 Unmute" : "🔊 Mute"}
              </Button>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Tempo: {bpm} BPM</label>
              <Slider value={[bpm]} onValueChange={(v)=>setBpm(v[0])} min={40} max={200} step={5}/>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 mb-3">Paste your 6‑line ASCII tab (standard tuning). Click <span className="font-semibold">Convert</span> to see numbered piano keys and a visual keyboard. Aligned digits make chords. Outside‑piano notes are skipped.</p>
              <p className="text-xs text-neutral-500 mb-3">
                Have only a screenshot? First use ChatGPT to transcribe it into clean 6-line ASCII tab. Click the ChatGPT Instructions button below to copy a ready-made prompt, paste it into ChatGPT with your image, then paste the returned tab here and Convert.
              </p>
              <Button variant="outline" onClick={copyInstructions} className="w-full">
                {copied ? "Copied!" : "ChatGPT Instructions"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Step Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-neutral-500">No events yet. Paste a tab and click Convert.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevStep}
                      disabled={(() => {
                        const stepsWithNotes = events.filter(e => e.notes.length > 0).map(e => e.step);
                        if (stepsWithNotes.length === 0) return true;
                        // Disabled only if we're at or before the first step with notes
                        const firstStepWithNotes = Math.min(...stepsWithNotes);
                        return cursor <= firstStepWithNotes;
                      })()}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1"/>Prev
                    </Button>
                    <div>
                      Step <span className="font-semibold">{cursor}</span> / {Math.max(...events.map(e => e.step))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextStep}
                      disabled={(() => {
                        const stepsWithNotes = events.filter(e => e.notes.length > 0).map(e => e.step);
                        return stepsWithNotes.length === 0 || !stepsWithNotes.find(step => step > cursor);
                      })()}
                    >
                      Next<ChevronRight className="w-4 h-4 ml-1"/>
                    </Button>
                  </div>
                  <ul className="text-sm list-disc pl-5">
                    {(() => {
                      const currentEvent = events.find(e => e.step === cursor);
                      if (currentEvent && currentEvent.notes.length > 0) {
                        return currentEvent.notes.map((n, i) => (
                          <li key={i} className="leading-6">
                            String <span className="font-mono">{n.string}</span> fret <span className="font-mono">{n.fret}</span> → MIDI <span className="font-mono">{n.midi}</span> → Piano key <span className="font-mono">{n.key}</span> (<span className="font-mono">{n.name}</span>)
                          </li>
                        ));
                      } else {
                        return [<li key="empty" className="text-neutral-500">(No notes at this step)</li>];
                      }
                    })()}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Keyboard activeMidis={activeMidis} />

      <Card>
        <CardHeader>
          <CardTitle>All Events (table)</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <div className="overflow-auto max-h-64 border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="text-left p-2">Step</th>
                    <th className="text-left p-2">String</th>
                    <th className="text-left p-2">Fret</th>
                    <th className="text-left p-2">MIDI</th>
                    <th className="text-left p-2">Piano Key (1–88)</th>
                    <th className="text-left p-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {events.flatMap((ev, i) => (
                    ev.notes.map((n, j) => (
                      <tr key={`${i}-${j}`} className="odd:bg-neutral-50">
                        <td className="p-2 font-mono">{ev.step}</td>
                        <td className="p-2 font-mono">{n.string}</td>
                        <td className="p-2 font-mono">{n.fret}</td>
                        <td className="p-2 font-mono">{n.midi}</td>
                        <td className="p-2 font-mono">{n.key}</td>
                        <td className="p-2 font-mono">{n.name}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-neutral-500">
        Tips:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Multi-digit frets are supported. Make sure digits are vertically aligned for chords.</li>
          <li>Only digits produce notes; other symbols are ignored for pitch. Timing uses column position.</li>
          <li>Piano key numbers: A0=1 … C8=88. (Mapping: key = MIDI − 20)</li>
          <li>Standard tuning assumed (e4, B3, G3, D3, A2, E2). Drop tuning tabs may shift pitches.</li>
        </ul>
      </div>
    </div>
  );
}
