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
  const { currentTab, createTab, selectTab } = useTabLibrary();
  const [dragActive, setDragActive] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

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

  // --- Global Drag & Drop Import (JSON) ---
  useEffect(() => {
    function inferSteps(content: string): number {
      const lines = content.replace(/\r/g,'').split('\n').filter(l=>/^(e|B|G|D|A|E)\|/.test(l));
      if (lines.length < 6) return 24;
      const first = lines[0];
      const body = first.slice(first.indexOf('|')+1).replace(/\|+$/,'');
      if (body.length % 2 === 0) {
        let fixed = true;
        for (let i=0;i<body.length;i+=2){
          const pair = body.slice(i,i+2);
          if (!/^--|\d-|\d\d$/.test(pair)) { fixed=false; break; }
        }
        if (fixed) return body.length/2;
      }
      return body.length || 24;
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes('Files')) setDragActive(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragActive(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      setImportMessage(null);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setImportMessage('Ignored: Not a JSON file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const data = JSON.parse(text);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON root');
          if (data.format !== 'guitar-tab-json') throw new Error('Unsupported format flag');
          if (!data.tab) throw new Error('Missing tab object');
          const { name, bpm, steps, content } = data.tab;
          if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid name');
            if (typeof content !== 'string' || content.trim().length === 0) throw new Error('Invalid content');
          const bpmNum = typeof bpm === 'number' ? bpm : 80;
          if (bpmNum < 40 || bpmNum > 240) throw new Error('BPM out of range (40-240)');
          let stepsNum = typeof steps === 'number' ? steps : inferSteps(content);
          if (stepsNum < 8 || stepsNum > 124) stepsNum = inferSteps(content);
          const newTab = createTab(name.trim(), content, bpmNum, stepsNum);
          selectTab(newTab.id);
          setCurrentContent(content);
          setImportMessage(`Imported tab: ${name.trim()}`);
        } catch (err: any) {
          setImportMessage('Import failed: ' + (err?.message || 'Unknown error'));
        }
      };
      reader.onerror = () => setImportMessage('Could not read file.');
      reader.readAsText(file);
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragleave', handleDragLeave);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragleave', handleDragLeave);
    };
  }, [createTab, selectTab, setCurrentContent]);

  // Auto-hide import message after a short delay
  useEffect(() => {
    if (importMessage) {
      const id = setTimeout(() => setImportMessage(null), 4000);
      return () => clearTimeout(id);
    }
  }, [importMessage]);

  return (
    <ContentContext.Provider value={{ currentContent, setCurrentContent, getCurrentContent }}>
      <div className="flex h-screen relative">
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
        {/* Drag Overlay */}
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 bg-blue-600/10 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-blue-400 z-50">
            <div className="text-center space-y-2">
              <p className="text-blue-700 font-semibold text-sm">Drop JSON tab file to import</p>
              <p className="text-xs text-blue-600">Format: guitartab.json export</p>
            </div>
          </div>
        )}
        {importMessage && (
          <div className="absolute bottom-4 right-4 bg-white shadow-lg border border-gray-200 rounded-md px-4 py-2 text-sm z-50">
            {importMessage}
          </div>
        )}
      </div>
    </ContentContext.Provider>
  );
}