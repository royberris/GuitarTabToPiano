import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TabLibraryProvider } from "@/app/contexts/TabLibraryContext";
import { ClientLayoutWrapper } from "@/components/ClientLayoutWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guitar Tab Tools - berris.dev",
  description: "Create, visualize & convert guitar tabs (piano + fretboard) at berris.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TabLibraryProvider>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </TabLibraryProvider>
      </body>
    </html>
  );
}
