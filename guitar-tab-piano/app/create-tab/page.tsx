"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RotateCcw } from "lucide-react";
import { useTabLibrary } from "@/app/contexts/TabLibraryContext";
import { useContent } from "@/components/ClientLayoutWrapper";

/**
 * Visual Tab Creator (Flat Timeline)
 *
 * Removed legacy "sections" concept. We edit a single continuous timeline
 * with a configurable number of steps (min 8, max 124). Each step is a column.
 * Multi‑digit frets will widen a string line naturally (common in ASCII tabs).
 */

const STRING_NAMES = ["e","B","G","D","A","E"] as const;

interface Note { string: number; fret: number; step: number; }

export default function CreateTab() {
  const { currentTab, autoSaveCurrentTab } = useTabLibrary();
  const { setCurrentContent } = useContent();
  const [notes, setNotes] = useState<Note[]>([]);
  const [copied, setCopied] = useState(false);
  const DEFAULT_STEPS = 24;
  const [totalSteps, setTotalSteps] = useState<number>(DEFAULT_STEPS); // new default 24

  // Parse existing tab content (flat format) when switching tabs
  useEffect(() => {
    if (!currentTab) return;
    if (currentTab.content && currentTab.content.trim().length > 0) {
      parseFlatTab(currentTab.content);
    } else {
      // Reset to fresh state for new/empty tab
      setNotes([]);
      setTotalSteps(DEFAULT_STEPS);
    }
  }, [currentTab]);

  const clampSteps = useCallback((v: number) => Math.min(124, Math.max(8, v)), []);

  // Parser for fixed-width encoding (each step = 2 chars):
  // Empty: '--' • Single-digit: 'd-' • Two-digit: 'dd' (10–24)
  // Clamp any parsed fret > 24.
  function parseFlatTab(tab: string) {
    const lines = tab.split('\n').filter(l => /^(e|B|G|D|A|E)\|/.test(l));
    if (lines.length < 6) return;
    const newNotes: Note[] = [];
    let inferredSteps = 0;

    lines.forEach((line, stringIndex) => {
      const parts = line.split('|');
      if (parts.length < 2) return;
      const body = parts.slice(1, -1).join('|');
      let step = 0;
      for (let i = 0; i < body.length;) {
        const first = body[i];
        const second = body[i + 1];
        // Two-digit fret (10-24)
        if (/\d/.test(first) && /\d/.test(second)) {
          const fret = Math.min(parseInt(first + second, 10), 24);
          newNotes.push({ string: stringIndex, fret, step });
          i += 2;
        } else if (/\d/.test(first) && second === '-') {
          // Single-digit encoded as d-
            newNotes.push({ string: stringIndex, fret: Math.min(parseInt(first, 10), 24), step });
            i += 2;
        } else if (first === '-' && second === '-') {
          // Empty cell
          i += 2;
        } else {
          // Fallback: treat single char as empty and advance
          i += 1;
        }
        step++;
      }
      if (step > inferredSteps) inferredSteps = step;
    });

    setNotes(newNotes);
    const desired = Math.max(DEFAULT_STEPS, inferredSteps);
    setTotalSteps(desired > 124 ? 124 : desired);
  }

  // Generate ASCII with fixed-width cells to avoid digit merging:
  // Each logical step becomes either '--', 'd-' or 'dd'.
  function generateTab(): string {
    return STRING_NAMES.map((stringName, stringIndex) => {
      let line = stringName + '|';
      for (let step = 0; step < totalSteps; step++) {
        const note = notes.find(n => n.string === stringIndex && n.step === step);
        if (!note) {
          line += '--';
        } else {
          const fretStr = note.fret.toString();
          if (fretStr.length === 1) {
            line += fretStr + '-';
          } else {
            line += fretStr; // two-digit (10–24)
          }
        }
      }
      return line + '|';
    }).join('\n');
  }

  // Auto-save debounce
  useEffect(() => {
    const id = setTimeout(() => {
      const tabContent = generateTab();
      setCurrentContent(tabContent);
      if (currentTab) autoSaveCurrentTab(tabContent);
    }, 100);
    return () => clearTimeout(id);
  }, [notes, totalSteps, currentTab, autoSaveCurrentTab, setCurrentContent]);

  // Adjust total steps; prune notes out of range
  function updateTotalSteps(newValue: number) {
    const clamped = clampSteps(newValue);
    setTotalSteps(clamped);
    setNotes(prev => prev.filter(n => n.step < clamped));
  }

  function increaseNote(string: number, step: number) {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.string === string && n.step === step);
      if (idx >= 0) {
        const copy = [...prev];
        if (copy[idx].fret < 24) copy[idx] = { ...copy[idx], fret: copy[idx].fret + 1 };
        return copy;
      }
      return [...prev, { string, fret: 0, step }];
    });
  }

  function decreaseNote(string: number, step: number) {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.string === string && n.step === step);
      if (idx === -1) return prev;
      const copy = [...prev];
      const note = copy[idx];
      if (note.fret > 0) {
        copy[idx] = { ...note, fret: note.fret - 1 };
        return copy;
      }
      copy.splice(idx, 1);
      return copy;
    });
  }

  function getNote(string: number, step: number) {
    return notes.find(n => n.string === string && n.step === step);
  }

  function clearAll() {
    setNotes([]);
  }

  function copyTab() {
    const tab = generateTab();
    navigator.clipboard.writeText(tab).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Visual Tab Creator</h2>
        <p className="text-sm text-gray-600 mt-2">Flat timeline • Click cells to add notes • Right click to remove/decrease</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Fretboard (Steps: {totalSteps})</span>
            {currentTab && <span className="text-xs text-gray-500">Editing: {currentTab.name}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step ruler */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <div className="flex mb-2 select-none">
                <div className="w-8" />
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div key={i} className="w-10 text-center text-[10px] text-gray-500">
                    {i + 1}
                  </div>
                ))}
              </div>
              {STRING_NAMES.map((s, stringIndex) => (
                <div key={s} className="flex items-center mb-1">
                  <div className="w-8 text-right pr-2 text-sm font-mono font-bold">{s}</div>
                  {Array.from({ length: totalSteps }, (_, step) => {
                    const note = getNote(stringIndex, step);
                    return (
                      <button
                        key={step}
                        className={`w-10 h-10 m-0.5 border rounded text-xs font-mono flex items-center justify-center transition-colors
                          ${note ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'}`}
                        onClick={(e) => { e.preventDefault(); increaseNote(stringIndex, step); }}
                        onContextMenu={(e) => { e.preventDefault(); decreaseNote(stringIndex, step); }}
                        title={`String ${s}, Step ${step + 1}${note ? `, Fret ${note.fret}` : ''}\nLeft click: increase fret\nRight click: decrease/remove`}
                      >
                        {note?.fret ?? ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
      <div className="mt-4 text-xs text-gray-500">Encoding: empty='--', single='d-', double='dd'. Prevents adjacent single digits merging. Horizontal scroll for more steps (max 124).</div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Timeline Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <label className="font-medium">Total Steps</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  min={8}
                  max={124}
                  value={totalSteps}
                  onChange={(e) => updateTotalSteps(parseInt(e.target.value || '0', 10))}
                  className="w-24 px-2 py-1 border rounded text-sm"
                />
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => updateTotalSteps(totalSteps - 1)} disabled={totalSteps <= 8}>-1</Button>
                  <Button variant="outline" size="sm" onClick={() => updateTotalSteps(totalSteps + 1)} disabled={totalSteps >= 124}>+1</Button>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Range 8–124 columns.</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyTab} className="flex-1">
                <Copy className="w-4 h-4 mr-1" /> {copied ? 'Copied!' : 'Copy Tab'}
              </Button>
              <Button variant="outline" onClick={clearAll} title="Clear all notes">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <Button asChild variant="secondary" className="w-full" title="Go to piano converter">
                <Link href="/convert">🎹 Convert to Piano</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>ASCII Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre leading-5">
{generateTab()}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-neutral-500">
        Left click = add/increase fret • Right click = decrease/remove • Fret max 24
      </div>
    </div>
  );
}