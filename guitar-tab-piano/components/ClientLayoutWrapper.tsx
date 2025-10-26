"use client";
import { TabLibrarySidebar } from "@/components/library/TabLibrarySidebar";
import Link from "next/link";
import { ReactNode, createContext, useContext, useState, useCallback, useEffect } from "react";
import { useTabLibrary } from "@/app/contexts/TabLibraryContext";

// Context to manage current content across pages
interface ContentContextType {
  currentContent: string;
  setCurrentContent: (content: string) => void;
  getCurrentContent: () => string;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within ContentProvider');
  }
  return context;
}

interface ClientLayoutWrapperProps {
  children: ReactNode;
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const [currentContent, setCurrentContent] = useState('');
  const { currentTab } = useTabLibrary();

  const getCurrentContent = useCallback(() => currentContent, [currentContent]);

  const handleTabSelect = useCallback((content: string) => {
    setCurrentContent(content);
  }, []);

  // When a tab is auto-selected by TabLibraryContext on first load, seed the content
  useEffect(() => {
    if (currentTab && !currentContent) {
      setCurrentContent(currentTab.content);
    }
  }, [currentTab, currentContent]);

  return (
    <ContentContext.Provider value={{ currentContent, setCurrentContent, getCurrentContent }}>
      <div className="flex h-screen">
        <TabLibrarySidebar 
          onTabSelect={handleTabSelect}
          getCurrentContent={getCurrentContent}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <nav className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <Link href="/" className="text-xl font-bold hover:text-blue-600 transition-colors">
                Guitar Tab Tools
              </Link>
              <div className="flex gap-4">
                <Link 
                  href="/create-tab" 
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Create Tab
                </Link>
                <Link 
                  href="/convert" 
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Convert to Piano
                </Link>
              </div>
            </div>
          </nav>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </ContentContext.Provider>
  );
}