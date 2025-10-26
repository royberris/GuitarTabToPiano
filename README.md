# GuitarTabToPiano

Tools for working with ASCII guitar tabs: create visually, convert to piano playback, and now visualize & play directly on a virtual guitar fretboard.

Current Features:
- Visual Tab Creator (grid based, fixed-width encoding to preserve digits)
- Piano Converter (maps frets to MIDI + 88-key highlight & playback)
- Guitar Visualizer (NEW) – highlights frets in real-time and plays guitar Soundfont

Run the app (Next.js 16):
```
npm install
npm run dev
```
Then open http://localhost:3000.

Navigate via the top bar:
- Create Tab
- Convert to Piano
- Guitar Visualizer (🎸)

Standard tuning (e B G D A E) assumed across all tools. Max fret supported = 24.
