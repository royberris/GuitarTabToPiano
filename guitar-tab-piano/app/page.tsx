"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTabLibrary } from "@/app/contexts/TabLibraryContext";
import { useContent } from "@/components/ClientLayoutWrapper";

// Home / Overview Page
// Shows currently selected tab from the sidebar context and offers two actions:
// 1. Edit Tab (visual creator) → /create-tab
// 2. Play / Convert Tab → /convert

export default function HomeOverview() {
	const { currentTab } = useTabLibrary();
	const { currentContent } = useContent();

	// Prefer live edited content; fallback to stored tab content
	const displayContent = currentContent || currentTab?.content || '';
	const hasTab = Boolean(currentTab);

	return (
		<div className="p-6 max-w-5xl mx-auto space-y-8">
			<div className="text-center space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Guitar Tab Tools</h1>
				<p className="text-sm text-neutral-600">Select a tab in the sidebar, then choose an action below.</p>
			</div>

			<div className="grid md:grid-cols-3 gap-6">
				<Card className="md:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span>Selected ASCII Tab</span>
							{currentTab && (
								<span className="text-xs font-medium text-neutral-500">{currentTab.name}</span>
							)}
						</CardTitle>
					</CardHeader>
						<CardContent>
											{hasTab ? (
												<pre className="text-xs font-mono bg-neutral-50 border rounded p-3 overflow-x-auto whitespace-pre leading-5 max-h-64">
													{displayContent}
												</pre>
							) : (
								<div className="text-sm text-neutral-500 space-y-2">
									<p>No tab selected.</p>
									<ul className="list-disc pl-5 text-xs space-y-1">
										<li>Use the sidebar to create a new tab or pick an existing one.</li>
										<li>Then return here to edit visually or convert to piano playback.</li>
									</ul>
								</div>
							)}
						</CardContent>
				</Card>

				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Button className="w-full" asChild disabled={!hasTab}>
								<Link href="/create-tab">✏️ Edit / Build Tab</Link>
							</Button>
							<Button className="w-full" variant="secondary" asChild disabled={!hasTab}>
								<Link href="/convert">🎹 Play Tab on Piano</Link>
							</Button>
							<Button className="w-full" variant="outline" asChild disabled={!hasTab}>
								<Link href="/visualize-guitar">🎸 Visualize on Guitar</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Quick Tips</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="list-disc pl-5 text-xs space-y-1 text-neutral-600">
								<li>Create visually if you don't have an ASCII tab yet.</li>
								<li>Use multi-digit frets (10,11,12,etc.) as needed.</li>
								<li>Playback assumes standard tuning (e B G D A E).</li>
							</ul>
						</CardContent>
					</Card>
				</div>
			</div>

			<div className="text-center text-[11px] text-neutral-500">
				Visual Creator → build tab by clicking frets • Converter → map frets to piano & playback.
			</div>
		</div>
	);
}
