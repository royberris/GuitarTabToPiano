"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTabLibrary } from '@/app/contexts/TabLibraryContext';
import { Plus, FileText, Trash2, Edit3, Music } from 'lucide-react';

interface TabLibrarySidebarProps {
  onTabSelect?: (content: string) => void;
  getCurrentContent?: () => string;
}

export function TabLibrarySidebar({ onTabSelect, getCurrentContent }: TabLibrarySidebarProps) {
  const { tabs, currentTab, createTab, updateTab, deleteTab, selectTab, clearSelection } = useTabLibrary();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [loadTabName, setLoadTabName] = useState('');
  const [loadTabContent, setLoadTabContent] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateTab = () => {
    if (newTabName.trim()) {
      // Auto-save current tab before creating new one
      if (currentTab && getCurrentContent) {
        const currentContent = getCurrentContent();
        updateTab(currentTab.id, { content: currentContent });
      }
      
      // Create empty tab (no default content)
      const newTab = createTab(newTabName.trim());
      selectTab(newTab.id);
      if (onTabSelect) {
        onTabSelect(newTab.content);
      }
      setNewTabName('');
      setIsCreating(false);
    }
  };

  // Validate pasted ASCII tab (flat format): 6 lines starting with e| B| G| D| A| E|
  function validateAsciiTab(raw: string) {
    const cleaned = raw.replace(/\r/g,'').trim();
    const lines = cleaned.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 6) {
      return { ok: false, reason: 'Need at least 6 lines.' };
    }
    // Attempt to locate the 6 consecutive lines in correct order
    for (let i = 0; i <= lines.length - 6; i++) {
      const slice = lines.slice(i, i + 6);
      const expected = [/^[eE]\|/, /^B\|/, /^G\|/, /^D\|/, /^A\|/, /^E\|/];
      if (slice.every((line, idx) => expected[idx].test(line))) {
        // Basic character validation: allow digits, hyphen, pipes, spaces and multi-digit frets
        const bodyOk = slice.every(line => /[\d\-|]/.test(line));
        if (!bodyOk) {
          return { ok: false, reason: 'Unexpected characters detected.' };
        }
        return { ok: true, lines: slice };
      }
    }
    return { ok: false, reason: 'Could not find 6 ordered lines starting with e| B| G| D| A| E|.' };
  }

  const handleLoadTab = () => {
    setLoadError(null);
    const name = (loadTabName || 'Loaded Tab').trim();
    const result = validateAsciiTab(loadTabContent);
    if (!result.ok) {
      setLoadError(result.reason || 'Invalid tab.');
      return;
    }
    // Auto-save current before switching
    if (currentTab && getCurrentContent) {
      updateTab(currentTab.id, { content: getCurrentContent() });
    }
    // Normalize lines: ensure each ends with a trailing pipe
    const normalized = result.lines!.map(l => l.endsWith('|') ? l : l + '|').join('\n');
    const newTab = createTab(name, normalized);
    selectTab(newTab.id);
    if (onTabSelect) onTabSelect(newTab.content);
    // Reset loader state
    setIsLoadingTab(false);
    setLoadTabName('');
    setLoadTabContent('');
  };

  const handleSelectTab = (tabId: string) => {
    // Auto-save current tab before switching
    let currentContent = '';
    if (currentTab && getCurrentContent) {
      currentContent = getCurrentContent();
    }
    
    selectTab(tabId, currentContent);
    const tab = tabs.find(t => t.id === tabId);
    if (tab && onTabSelect) {
      onTabSelect(tab.content);
    }
  };

  const handleRename = (id: string, newName: string) => {
    if (newName.trim()) {
      updateTab(id, { name: newName.trim() });
    }
    setEditingId(null);
    setEditingName('');
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-80 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      <Card className="flex-1 rounded-none border-0 bg-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="w-5 h-5" />
            Tab Library
          </CardTitle>
          
          {/* New / Load Tab Actions */}
          {!isCreating && !isLoadingTab && (
            <div className="flex gap-2">
              <Button 
                onClick={() => { setIsCreating(true); setIsLoadingTab(false); }}
                className="flex-1"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" /> New Tab
              </Button>
              <Button 
                variant="outline"
                onClick={() => { setIsLoadingTab(true); setIsCreating(false); }}
                className="flex-1"
                size="sm"
              >
                Load Tab
              </Button>
            </div>
          )}

          {isCreating && (
            <div className="space-y-2 mt-2">
              <input
                type="text"
                placeholder="Tab name..."
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTab();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTabName('');
                  }
                }}
                className="w-full px-3 py-2 text-sm border rounded-md"
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateTab} size="sm" className="flex-1">Create</Button>
                <Button variant="outline" onClick={() => { setIsCreating(false); setNewTabName(''); }} size="sm" className="flex-1">Cancel</Button>
              </div>
            </div>
          )}

          {isLoadingTab && (
            <div className="space-y-2 mt-2">
              <input
                type="text"
                placeholder="Tab name... (optional)"
                value={loadTabName}
                onChange={(e) => setLoadTabName(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md"
                autoFocus
              />
              <textarea
                placeholder={"Paste 6-line ASCII tab starting with:\ne|\nB|\nG|\nD|\nA|\nE|"}
                value={loadTabContent}
                onChange={(e) => setLoadTabContent(e.target.value)}
                className="w-full h-32 text-xs font-mono p-2 border rounded-md resize-none"
              />
              {loadError && <div className="text-xs text-red-600">{loadError}</div>}
              <div className="flex gap-2">
                <Button 
                  onClick={handleLoadTab}
                  size="sm"
                  className="flex-1"
                  disabled={loadTabContent.trim().length === 0}
                >Validate & Load</Button>
                <Button 
                  variant="outline" 
                  onClick={() => { setIsLoadingTab(false); setLoadTabContent(''); setLoadTabName(''); setLoadError(null); }}
                  size="sm"
                  className="flex-1"
                >Cancel</Button>
              </div>
              <div className="text-[10px] text-gray-500">Only standard 6-line ASCII tabs accepted.</div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-4 pt-0">
          <div className="space-y-2">
            {tabs.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No tabs yet. Create your first tab!
              </div>
            ) : (
              tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-colors group
                    ${currentTab?.id === tab.id 
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' 
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => handleSelectTab(tab.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingId === tab.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleRename(tab.id, editingName);
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditingName('');
                            }
                          }}
                          onBlur={() => handleRename(tab.id, editingName)}
                          className="w-full px-2 py-1 text-sm font-medium border rounded"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 className="font-medium text-sm truncate">{tab.name}</h3>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(tab.updatedAt)}
                      </p>
                      
                      {/* Preview first line */}
                      <div className="text-xs text-gray-400 mt-1 font-mono truncate">
                        {tab.content.split('\n')[0] || 'Empty tab'}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(tab.id, tab.name);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Rename"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${tab.name}"?`)) {
                            deleteTab(tab.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Created by{' '}
          <a 
            href="https://berris.dev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            Roy Berris
          </a>
        </div>
      </div>
    </div>
  );
}