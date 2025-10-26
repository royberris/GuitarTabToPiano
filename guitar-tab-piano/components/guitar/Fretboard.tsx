"use client";
import React from 'react';
import { ParsedNote } from '@/lib/tabParser';

interface FretboardProps {
  activeNotes: ParsedNote[]; // notes at current playback cursor
  maxFrets?: number; // number of frets to render (inclusive) default 12
  showNoteNames?: boolean;
}

const STRING_ORDER: string[] = ["e","B","G","D","A","E"]; // top→bottom

export function Fretboard({ activeNotes, maxFrets = 12, showNoteNames = true }: FretboardProps) {
  const clampedMax = Math.min(24, Math.max(4, maxFrets));
  // Map active notes for quick lookup by string+fret
  const activeMap = new Set(activeNotes.map(n => `${n.string}:${n.fret}`));

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        {/* Fret numbers header */}
        <div className="flex mb-2 ml-12">
          {Array.from({ length: clampedMax + 1 }, (_, fret) => (
            <div key={fret} className="w-12 text-center text-[10px] text-neutral-500">{fret}</div>
          ))}
        </div>
        {STRING_ORDER.map(stringName => (
          <div key={stringName} className="flex items-center mb-1">
            <div className="w-12 text-right pr-2 font-mono text-sm font-semibold">{stringName}</div>
            {Array.from({ length: clampedMax + 1 }, (_, fret) => {
              const isActive = activeMap.has(`${stringName}:${fret}`);
              const note = isActive ? activeNotes.find(n => n.string === stringName && n.fret === fret) : null;
              return (
                <div
                  key={fret}
                  className={`w-12 h-12 m-0.5 flex items-center justify-center rounded border text-xs font-mono transition-colors
                    ${isActive ? 'bg-green-500 text-white border-green-600 shadow-md' : 'bg-neutral-50 border-neutral-300'}`}
                  title={note ? `${note.name} (MIDI ${note.midi})` : `String ${stringName} fret ${fret}`}
                >
                  {isActive && showNoteNames ? note?.fret : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Fretboard;
