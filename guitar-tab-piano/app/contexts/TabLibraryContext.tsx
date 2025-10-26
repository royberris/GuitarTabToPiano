"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface TabItem {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TabLibraryContextType {
  tabs: TabItem[];
  currentTab: TabItem | null;
  createTab: (name: string, content?: string) => TabItem;
  updateTab: (id: string, updates: Partial<Pick<TabItem, 'name' | 'content'>>) => void;
  deleteTab: (id: string) => void;
  selectTab: (id: string, autoSaveContent?: string) => void;
  clearSelection: () => void;
  autoSaveCurrentTab: (content: string) => void;
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

  const createTab = useCallback((name: string, content: string = '') => {
    const newTab: TabItem = {
      id: Date.now().toString(),
      name,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTabs(prev => [newTab, ...prev]);
    return newTab;
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Pick<TabItem, 'name' | 'content'>>) => {
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

  const selectTab = useCallback((id: string, autoSaveContent?: string) => {
    // Auto-save current tab before switching if content is provided
    if (currentTab && autoSaveContent !== undefined) {
      updateTab(currentTab.id, { content: autoSaveContent });
    }
    
    const tab = tabs.find(t => t.id === id);
    setCurrentTab(tab || null);
  }, [currentTab, tabs, updateTab]);

  const clearSelection = useCallback(() => {
    setCurrentTab(null);
  }, []);

  const autoSaveCurrentTab = useCallback((content: string) => {
    if (currentTab) {
      updateTab(currentTab.id, { content });
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