"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface TabItem {
  id: string;
  name: string;
  content: string;
  bpm: number; // playback tempo associated with this tab
  steps: number; // number of timeline steps (columns)
  createdAt: Date;
  updatedAt: Date;
}

interface TabLibraryContextType {
  tabs: TabItem[];
  currentTab: TabItem | null;
  createTab: (name: string, content?: string, bpm?: number, steps?: number) => TabItem;
  updateTab: (id: string, updates: Partial<Pick<TabItem, 'name' | 'content' | 'bpm' | 'steps'>>) => void;
  deleteTab: (id: string) => void;
  selectTab: (id: string, autoSaveContent?: string, autoSaveBpm?: number, autoSaveSteps?: number) => void;
  clearSelection: () => void;
  autoSaveCurrentTab: (content: string, bpm?: number, steps?: number) => void;
}

const TabLibraryContext = createContext<TabLibraryContextType | undefined>(undefined);

export function useTabLibrary() {
  const context = useContext(TabLibraryContext);
  if (context === undefined) {
    throw new Error('useTabLibrary must be used within a TabLibraryProvider');
  }
  return context;
}

interface TabLibraryProviderProps {
  children: ReactNode;
}

export function TabLibraryProvider({ children }: TabLibraryProviderProps) {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [currentTab, setCurrentTab] = useState<TabItem | null>(null);

  // Load tabs from localStorage on mount
  useEffect(() => {
    try {
      const savedTabs = localStorage.getItem('guitar-tab-library');
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs).map((tab: any) => ({
          ...tab,
          bpm: typeof tab.bpm === 'number' ? tab.bpm : 80,
          steps: typeof tab.steps === 'number' ? tab.steps : inferStepsFromContent(tab.content),
          createdAt: new Date(tab.createdAt),
          updatedAt: new Date(tab.updatedAt),
        }));
        setTabs(parsedTabs);
        
        // Auto-select the first tab
        if (parsedTabs.length > 0) {
          setCurrentTab(parsedTabs[0]);
        }
      } else {
        // Create default tab if no tabs exist
        const defaultTab = createDefaultTab();
        setTabs([defaultTab]);
        setCurrentTab(defaultTab);
      }
    } catch (error) {
      console.error('Failed to load tabs from localStorage:', error);
      // Create default tab on error
      const defaultTab = createDefaultTab();
      setTabs([defaultTab]);
      setCurrentTab(defaultTab);
    }
  }, []);

  // Create the default "My First Tab"
  const createDefaultTab = (): TabItem => {
    const defaultContent = `e|--0-----3-----2-----0-----|\nB|----1-----0-----3-----1---|\nG|------0-----0-----2-----0-|\nD|--------2-----0-----0-----2|\nA|--3-------2-------0-----3-|\nE|--------------------------|`;
    
    return {
      id: Date.now().toString(),
      name: 'My First Tab',
      content: defaultContent,
      bpm: 80,
      steps: inferStepsFromContent(defaultContent),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  // Save tabs to localStorage whenever tabs change
  useEffect(() => {
    if (tabs.length > 0) {
      try {
        localStorage.setItem('guitar-tab-library', JSON.stringify(tabs));
      } catch (error) {
        console.error('Failed to save tabs to localStorage:', error);
      }
    }
  }, [tabs]);

  const createTab = useCallback((name: string, content: string = '', bpm: number = 80, steps: number = 24) => {
    const newTab: TabItem = {
      id: Date.now().toString(),
      name,
      content,
      bpm,
      steps,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTabs(prev => [newTab, ...prev]);
    return newTab;
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Pick<TabItem, 'name' | 'content' | 'bpm' | 'steps'>>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === id 
        ? { ...tab, ...updates, updatedAt: new Date() }
        : tab
    ));

    // Update current tab if it's the one being updated
    if (currentTab?.id === id) {
      setCurrentTab(prev => prev ? { ...prev, ...updates, updatedAt: new Date() } : null);
    }
  }, [currentTab?.id]);

  const deleteTab = useCallback((id: string) => {
    const currentTabIndex = tabs.findIndex(tab => tab.id === id);
    const filteredTabs = tabs.filter(tab => tab.id !== id);
    
    // If this was the last tab, create an empty tab
    if (filteredTabs.length === 0) {
      const emptyTab: TabItem = {
        id: Date.now().toString(),
        name: 'Empty Tab',
        content: '',
        bpm: 80,
        steps: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setTabs([emptyTab]);
      setCurrentTab(emptyTab);
    } else {
      setTabs(filteredTabs);
      
      // Auto-select another tab if the current one was deleted
      if (currentTab?.id === id) {
        // Try to select the tab at the same index, or the previous one if at the end
        const newIndex = currentTabIndex >= filteredTabs.length ? filteredTabs.length - 1 : currentTabIndex;
        setCurrentTab(filteredTabs[newIndex]);
      }
    }
  }, [tabs, currentTab?.id]);

  const selectTab = useCallback((id: string, autoSaveContent?: string, autoSaveBpm?: number, autoSaveSteps?: number) => {
    if (currentTab) {
      const updates: Partial<Pick<TabItem,'content'|'bpm'|'steps'>> = {};
      if (autoSaveContent !== undefined) updates.content = autoSaveContent;
      if (autoSaveBpm !== undefined) updates.bpm = autoSaveBpm;
      if (autoSaveSteps !== undefined) updates.steps = autoSaveSteps;
      if (Object.keys(updates).length) updateTab(currentTab.id, updates);
    }
    
    const tab = tabs.find(t => t.id === id);
    setCurrentTab(tab || null);
  }, [currentTab, tabs, updateTab]);

  const clearSelection = useCallback(() => {
    setCurrentTab(null);
  }, []);

  const autoSaveCurrentTab = useCallback((content: string, bpm?: number, steps?: number) => {
    if (currentTab) {
      const updates: Partial<Pick<TabItem,'content'|'bpm'|'steps'>> = { content };
      if (typeof bpm === 'number') updates.bpm = bpm;
      if (typeof steps === 'number') updates.steps = steps;
      updateTab(currentTab.id, updates);
    }
  }, [currentTab, updateTab]);

  return (
    <TabLibraryContext.Provider value={{
      tabs,
      currentTab,
      createTab,
      updateTab,
      deleteTab,
      selectTab,
      clearSelection,
      autoSaveCurrentTab,
    }}>
      {children}
    </TabLibraryContext.Provider>
  );
}

// Infer steps (columns) from ASCII content. Supports fixed-width (2 chars per step) and legacy variable width.
function inferStepsFromContent(content: string): number {
  if (!content) return 24;
  const lines = content.replace(/\r/g,'').split('\n').filter(l=>/^(e|B|G|D|A|E)\|/.test(l));
  if (lines.length < 6) return 24;
  // Take first string line as representative
  const first = lines[0];
  const body = first.slice(first.indexOf('|')+1).replace(/\|+$/,'');
  if (body.length % 2 === 0) {
    // Check if fixed-width pattern holds
    let fixed = true;
    for (let i=0;i<body.length;i+=2){
      const pair = body.slice(i,i+2);
      if (!/^--|\d-|\d\d$/.test(pair)) { fixed=false; break; }
    }
    if (fixed) return body.length/2;
  }
  return body.length || 24;
}