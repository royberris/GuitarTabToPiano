"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabLibrary } from '@/app/contexts/TabLibraryContext';
import { useContent } from '@/components/ClientLayoutWrapper';
import { parseAsciiTab, TabEvent } from '@/lib/tabParser';
import { initGuitarInstrument, playGuitarChord, GuitarInstrumentHandle } from '@/lib/guitarAudio';
import Fretboard from '@/components/guitar/Fretboard';
import Link from 'next/link';

export default function GuitarVisualizerPage() {
  const { currentTab } = useTabLibrary();
  const { currentContent, setCurrentContent } = useContent();
  const [tab, setTab] = useState<string>('');
  const [events, setEvents] = useState<TabEvent[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [maxFrets, setMaxFrets] = useState(12);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<number | null>(null);
  const instrumentRef = useRef<GuitarInstrumentHandle | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    initGuitarInstrument().then(handle => {
      instrumentRef.current = handle;
    });
  }, []);

  // Sync with current tab from library
  useEffect(() => {
    if (currentTab) {
      setTab(currentTab.content);
      setCurrentContent(currentTab.content);
      if (typeof (currentTab as any).bpm === 'number') setBpm((currentTab as any).bpm);
    } else {
      setTab('');
      setCurrentContent('');
    }
  }, [currentTab, setCurrentContent]);

  // Auto-convert on tab change
  useEffect(() => {
    if (tab && tab.trim().length) {
      try {
        const { events } = parseAsciiTab(tab);
        setEvents(events);
        setCursor(0);
        setPlaying(false);
      } catch (err: any) {
        // Silently ignore parse errors on auto; user has read-only tab here
        console.warn('Parse error:', err?.message);
      }
    } else {
      setEvents([]);
      setCursor(0);
      setPlaying(false);
    }
  }, [tab]);

  // Milliseconds per step (treat each step as an eighth note similar to convert page)
  const msPerStep = useMemo(() => (60000 / bpm) / 2, [bpm]);

  const activeNotes = useMemo(() => {
    const ev = events.find(e => e.step === cursor);
    return ev ? ev.notes : [];
  }, [events, cursor]);

  function startPlayback() {
    if (!events.length) return;
    setPlaying(true);
    let currentStep = cursor;
    const totalSteps = Math.max(...events.map(e => e.step)) + 1;
    const tick = () => {
      const ev = events.find(e => e.step === currentStep);
      if (ev && ev.notes.length && instrumentRef.current && !isMuted) {
        const midis = ev.notes.map(n => n.midi);
        const duration = msPerStep / 1000 * 0.9;
        playGuitarChord(instrumentRef.current, midis, duration);
      }
      setCursor(currentStep);
      currentStep++;
      if (currentStep >= totalSteps) {
        stopPlayback();
        return;
      }
      timerRef.current = window.setTimeout(tick, msPerStep);
    };
    timerRef.current = window.setTimeout(tick, 0);
  }

  function stopPlayback() {
    setPlaying(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function resetPlayback() {
    stopPlayback();
    setCursor(0);
  }

  function goToPrevStep() {
    if (!events.length) return;
    const stepsWithNotes = events.filter(e => e.notes.length).map(e => e.step).sort((a,b)=>a-b);
    if (!stepsWithNotes.length) return;
    const prev = [...stepsWithNotes].reverse().find(s => s < cursor);
    setCursor(prev !== undefined ? prev : stepsWithNotes[stepsWithNotes.length-1]);
  }

  function goToNextStep() {
    if (!events.length) return;
    const stepsWithNotes = events.filter(e => e.notes.length).map(e => e.step).sort((a,b)=>a-b);
    const next = stepsWithNotes.find(s => s > cursor);
    if (next !== undefined) setCursor(next);
  }

  // Cleanup on unmount to stop any running playback timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">Guitar Tab → Guitar Fretboard Visualizer</h2>
        <p className="text-sm text-neutral-600">Playback your tab with highlighted frets and guitar Soundfont audio.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tab Preview</span>
              {currentTab && <span className="text-xs text-neutral-500">{currentTab.name}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={tab}
              readOnly
              className="w-full h-56 font-mono text-xs p-3 rounded-xl border bg-neutral-50 cursor-not-allowed"
              placeholder={`e|--0--2--3--|
B|------------|
G|------------|
D|------------|
A|------------|
E|------------|`}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button asChild variant="outline"><Link href="/create-tab">✏️ Edit Tab</Link></Button>
              {!playing ? (
                <Button variant="secondary" onClick={startPlayback} disabled={!events.length}><Play className="w-4 h-4 mr-1"/>Play</Button>
              ) : (
                <Button variant="secondary" onClick={stopPlayback}><Pause className="w-4 h-4 mr-1"/>Pause</Button>
              )}
              <Button variant="ghost" onClick={resetPlayback}><RotateCcw className="w-4 h-4 mr-1"/>Reset</Button>
              <Button variant="outline" onClick={()=>setIsMuted(m=>!m)}>{isMuted ? '🔇 Unmute' : '🔊 Mute'}</Button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Tempo: {bpm} BPM</label>
                <Slider value={[bpm]} onValueChange={v=>setBpm(v[0])} min={40} max={200} step={5} />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Max Frets: {maxFrets}</label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={maxFrets}
                  onChange={e=>setMaxFrets(parseInt(e.target.value,10))}
                  className="flex-1"
                />
              </div>
              <p className="text-[11px] text-neutral-500">Rendering top→bottom strings (e B G D A E). Increase max frets to view higher fret positions.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Step Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm mb-2">
              <Button size="sm" variant="outline" onClick={goToPrevStep} disabled={!events.length}><ChevronLeft className="w-4 h-4 mr-1"/>Prev</Button>
              <span>Step <strong>{cursor}</strong> / {events.length ? Math.max(...events.map(e=>e.step)) : 0}</span>
              <Button size="sm" variant="outline" onClick={goToNextStep} disabled={!events.find(e=>e.step>cursor)} >Next<ChevronRight className="w-4 h-4 ml-1"/></Button>
            </div>
            <ul className="text-xs list-disc pl-5 space-y-1">
              {activeNotes.length ? activeNotes.map((n,i)=>(
                <li key={i}>String <span className="font-mono">{n.string}</span> fret <span className="font-mono">{n.fret}</span> → MIDI <span className="font-mono">{n.midi}</span> ({n.name})</li>
              )) : <li className="text-neutral-500">(No notes at this step)</li>}
            </ul>
            <div className="mt-3 text-[11px] text-neutral-500">Audio: Soundfont acoustic guitar (nylon → steel fallback).</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fretboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Fretboard activeNotes={activeNotes} maxFrets={maxFrets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Events</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500">—</p>
          ) : (
            <div className="overflow-auto max-h-64 border rounded-xl">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="p-2 text-left">Step</th>
                    <th className="p-2 text-left">String</th>
                    <th className="p-2 text-left">Fret</th>
                    <th className="p-2 text-left">MIDI</th>
                    <th className="p-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {events.flatMap((ev,i)=>ev.notes.map((n,j)=>(
                    <tr key={`${i}-${j}`} className="odd:bg-neutral-50">
                      <td className="p-2 font-mono">{ev.step}</td>
                      <td className="p-2 font-mono">{n.string}</td>
                      <td className="p-2 font-mono">{n.fret}</td>
                      <td className="p-2 font-mono">{n.midi}</td>
                      <td className="p-2 font-mono">{n.name}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-[11px] text-neutral-500">Guitar Visualizer • Standard tuning • Fret max 24 • Each step treated as an eighth note.</div>
    </div>
  );
}
