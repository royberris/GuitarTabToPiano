This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Feature Overview

### Visual Tab Creator (`/create-tab`)
Grid-based editor. Left click increases fret, right click decreases/removes. Encodes each step with 2 characters to avoid merged digits (`--`, `d-`, `dd`). Auto-saves to localStorage with BPM and step count.

### Piano Converter (`/convert`)
Parses ASCII tab → MIDI → Piano key numbers (1–88). Highlights keys and plays chords using a piano Soundfont. Each step treated as an eighth note (tempo adjustable).

### Guitar Visualizer (`/visualize-guitar`)
NEW: Real-time fretboard highlighting. Uses the same parser to show active frets across strings (standard tuning). Plays notes with an acoustic guitar Soundfont (nylon fallback to steel). Adjustable max fret rendering (8–24) and BPM.

### Navigation / Data
- Tabs stored in localStorage under `guitar-tab-library`.
- Standard tuning fixed (e4 B3 G3 D3 A2 E2). Max fret clamp = 24.
- Parse supports fixed-width and legacy variable-width tabs.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
