"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import Soundfont from "soundfont-player"; // dependency already installed
import { parseAsciiTab, midiToName, midiToKeyNumber, isBlackKey, A0_MIDI } from "@/lib/tabParser";
import { useTabLibrary } from "@/app/contexts/TabLibraryContext";
import { useContent } from "@/components/ClientLayoutWrapper";

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
const PIANO_KEYS = Array.from({ length: 88 }, (_, i) => A0_MIDI + i);

// STRING_OPEN_MIDI now lives in shared parser module.

// ---------- Tab Parser ----------
  // ---------- UI Components ----------
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


export default function GuitarTabToPiano() {
  const { currentTab } = useTabLibrary();
  const { currentContent, setCurrentContent } = useContent();
  const [tab, setTab] = useState(`e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|--0--2--3--5----|\nE|----------------|\n`);
  const [events, setEvents] = useState<{ step: number; notes: { string: string; fret: number; midi: number; key: number; name: string }[] }[]>([]);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [bpm, setBpm] = useState(80); // BPM (may be overridden by tab's saved bpm)
  const timerRef = useRef<number | null>(null);
  // Removed ChatGPT prompt copy functionality
  const audioCtxRef = useRef<AudioContext | null>(null); // added
  const [instrument, setInstrument] = useState<any>(null); // added
  const [isMuted, setIsMuted] = useState(false); // audio mute state

  // Sync with current tab from library and content context
  useEffect(() => {
    if (currentTab) {
      setTab(currentTab.content);
      setCurrentContent(currentTab.content);
      if (typeof (currentTab as any).bpm === 'number') {
        setBpm((currentTab as any).bpm);
      }
    } else {
      setTab('');
      setCurrentContent('');
    }
  }, [currentTab, setCurrentContent]);

  // Update content context when tab changes
  useEffect(() => {
    setCurrentContent(tab);
  }, [tab, setCurrentContent]);

  // Editing disabled on convert page – we only mirror selected tab.

  // Convert BPM to milliseconds per step (assuming 16th notes)
  const msPerStep = useMemo(() => {
    // 60000 ms per minute / BPM = ms per quarter note
    // Previously treated each step as a 16th note ((60000/bpm)/4)
    // We now make each step twice as long (8th note): (60000/bpm)/2
    return (60000 / bpm) / 2;
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

  // (ChatGPT prompt removed)

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

  // Auto-convert when tab content changes or on initial load
  useEffect(() => {
    if (tab && tab.trim().length > 0) {
      onConvert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
      <div className="text-center">
        <h2 className="text-2xl font-bold">Guitar Tab → Piano Key Visualizer</h2>
        <p className="text-sm text-gray-600 mt-2">Convert ASCII guitar tabs to piano visualization with audio playback</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tab Preview</span>
              {currentTab && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Selected: {currentTab.name}</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={tab}
              readOnly
              className="w-full h-56 font-mono text-sm p-3 rounded-xl border bg-neutral-50 cursor-not-allowed"
              placeholder={`e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|--0--2--3--5----|\nE|----------------|`}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button asChild variant="outline">
                <Link href="/create-tab">✏️ Edit Tab</Link>
              </Button>
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
              <div className="mt-2 text-xs text-neutral-500">Encoding: each step is 2 chars (-- empty, d- single, dd double). Playback unaffected; max fret = 24.</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How it Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-700">
              <p>
                Each string has a fixed open MIDI note (e4=64, B3=59, G3=55, D3=50, A2=45, E2=40). A fret number <span className="font-mono">f</span> maps to <span className="font-mono">MIDI = open + f</span>. Piano key numbers are <span className="font-mono">MIDI − 20</span> (so A0=21 → key 1, C4=60 → key 40). We highlight those piano keys and optionally play them.
              </p>
              <p className="text-xs text-neutral-500">Standard tuning assumed; alternate tunings require manual adjustment before playback.</p>
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

      {/* Removed legacy tips block */}
    </div>
  );
}
