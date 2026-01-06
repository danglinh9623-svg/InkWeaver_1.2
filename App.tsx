import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, AppMode, StorySettings, ChatSession } from './types';
import { streamResponse, generateTitle } from './services/geminiService';
import { getSessions, saveSession, deleteSession } from './services/storageService';
import ChatMessage from './components/ChatMessage';
import SettingsPanel from './components/SettingsPanel';
import CharacterBuilder from './components/CharacterBuilder';
import { 
  Send, 
  BookOpen, 
  Sparkles, 
  Search, 
  Settings as SettingsIcon,
  Feather,
  Trash2,
  Download,
  Users,
  Plus,
  MessageSquare,
  History,
  Menu,
  X,
  Smartphone
} from 'lucide-react';

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: Role.MODEL,
  content: "Greetings. I am InkWeaver. What story shall we craft today? \n\nI can help you brainstorm plot twists, research fandom tropes, or simply write the next chapter of your masterpiece."
};

function App() {
  // Session State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // App State
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false); // Mobile sidebar toggle
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // Settings State
  const [settings, setSettings] = useState<StorySettings>({
    genre: 'General Fiction',
    tone: 'Neutral',
    pov: 'Third Limited',
    creativityLevel: 1.0,
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load Sessions on Mount
  useEffect(() => {
    const loaded = getSessions();
    setSessions(loaded);
  }, []);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Save Session Effect
  useEffect(() => {
    if (messages.length > 1 && currentSessionId) {
      // Don't save if it's just the initial greeting
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const title = currentSession?.title || 'New Story Idea';
      const preview = messages[messages.length - 1].content.substring(0, 60) + '...';

      const updatedSession: ChatSession = {
        id: currentSessionId,
        title: title,
        messages: messages,
        mode: mode,
        settings: settings,
        updatedAt: Date.now(),
        preview: preview
      };
      
      const newSessionList = saveSession(updatedSession);
      setSessions(newSessionList);
    }
  }, [messages, currentSessionId]); // Note: We don't depend on mode/settings changes to trigger save, only messages

  // Auto-scroll (Only in Chat Modes)
  useEffect(() => {
    if (mode !== AppMode.CHARACTER) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, mode]);

  // Handle Input Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // Session Management Functions
  const createNewChat = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([INITIAL_MESSAGE]);
    setMode(AppMode.CHAT);
    // We don't save immediately, only after first message
    if (window.innerWidth < 768) setShowMobileHistory(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setMode(session.mode);
    setSettings(session.settings);
    if (window.innerWidth < 768) setShowMobileHistory(false);
  };

  const deleteChatSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteSession(id);
    setSessions(updated);
    if (currentSessionId === id) {
      createNewChat();
    }
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Logic to process a response (used by Send and Regenerate)
  const processResponse = async (history: Message[], userText: string) => {
    // Generate Title Logic
    // We check if we have a session ID, and if the current title is "default" or missing.
    // We also limit it to the first few turns to avoid renaming long stories constantly.
    if (currentSessionId && history.length <= 4) {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const isDefaultTitle = !currentSession || 
                             currentSession.title === 'New Story Idea' || 
                             currentSession.title === 'Untitled Story';
      
      if (isDefaultTitle) {
        // We trigger title generation in background
        generateTitle(userText).then(title => {
           setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title } : s));
           // Force update local storage for the title immediately to prevent loss
           const sessionToUpdate = getSessions().find(s => s.id === currentSessionId);
           if (sessionToUpdate) {
             saveSession({ ...sessionToUpdate, title });
           }
        });
      }
    }

    // Placeholder Bot Message
    const botMsgId = (Date.now() + 1).toString();
    const botMsgPlaceholder: Message = {
      id: botMsgId,
      role: Role.MODEL,
      content: '',
      isStreaming: true
    };

    setMessages(prev => [...prev, botMsgPlaceholder]);
    setIsLoading(true);

    // Prepare History for API
    const historyForApi = history.map(m => ({
      role: m.role === Role.USER ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    try {
      let accumulatedText = '';
      let collectedSources: { uri: string; title: string }[] = [];

      await streamResponse(
        historyForApi,
        userText,
        mode,
        settings,
        (textChunk) => {
          accumulatedText += textChunk;
          setMessages(prev => 
            prev.map(m => 
              m.id === botMsgId 
                ? { ...m, content: accumulatedText } 
                : m
            )
          );
        },
        (sources) => {
          const newSources = sources.filter(s => 
            !collectedSources.some(existing => existing.uri === s.uri)
          );
          collectedSources = [...collectedSources, ...newSources];
          
          setMessages(prev => 
            prev.map(m => 
              m.id === botMsgId 
                ? { ...m, groundingSources: collectedSources } 
                : m
            )
          );
        }
      );
    } catch (error) {
      // The service layer now handles most errors by outputting to the stream,
      // so this block acts as a final failsafe.
      console.error(error);
      setMessages(prev => prev.map(m => 
        m.id === botMsgId 
          ? { ...m, content: m.content + "\n\n[System Error: An unexpected error occurred. Please check console.]", isError: true } 
          : m
      ));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
    }
  };

  // Send Logic
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    // Ensure we have a session ID
    if (!currentSessionId) {
      const newId = Date.now().toString();
      setCurrentSessionId(newId);
    }

    const userText = inputText.trim();
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: userText
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    
    await processResponse(newHistory, userText);
  };

  // Regenerate Logic
  const handleRegenerate = async () => {
    if (isLoading || messages.length < 2) return;

    // Find last user message
    let lastUserMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === Role.USER) {
        lastUserMsgIndex = i;
        break;
      }
    }
    
    if (lastUserMsgIndex === -1) return;

    const lastUserMsg = messages[lastUserMsgIndex];
    // Keep everything up to the last user message
    const historyToKeep = messages.slice(0, lastUserMsgIndex + 1);
    
    setMessages(historyToKeep);
    await processResponse(historyToKeep, lastUserMsg.content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const downloadChat = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkweaver-${currentSessionId || 'chat'}.txt`;
    a.click();
  };

  const SidebarContent = () => (
    <>
       <div className="p-6 border-b border-ink-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-accent-light font-serif font-bold text-xl">
            <Feather className="w-6 h-6" />
            <span>InkWeaver</span>
          </div>
          {/* Mobile close */}
          <button onClick={() => setShowMobileHistory(false)} className="md:hidden text-ink-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-2">
           <button 
             onClick={createNewChat}
             className="w-full flex items-center justify-center gap-2 p-3 bg-accent hover:bg-accent-dark text-white rounded-lg transition-all font-medium shadow-lg shadow-accent/20"
           >
             <Plus size={18} /> New Story
           </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Modes Section */}
          <div className="px-4 py-2 border-b border-ink-800/50">
            <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2">Tools</p>
            <div className="space-y-1">
               <button onClick={() => setMode(AppMode.CHAT)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${mode === AppMode.CHAT ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200'}`}>
                 <Sparkles size={16} /> Brainstorm
               </button>
               <button onClick={() => setMode(AppMode.STORY)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${mode === AppMode.STORY ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200'}`}>
                 <BookOpen size={16} /> Story Writer
               </button>
               <button onClick={() => setMode(AppMode.RESEARCH)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${mode === AppMode.RESEARCH ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200'}`}>
                 <Search size={16} /> Trope Research
               </button>
               <button onClick={() => setMode(AppMode.CHARACTER)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${mode === AppMode.CHARACTER ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200'}`}>
                 <Users size={16} /> Character Studio
               </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
             <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2 mt-2">Recent Stories</p>
             <div className="space-y-1">
               {sessions.length === 0 && (
                 <div className="text-xs text-ink-600 italic px-2">No history yet.</div>
               )}
               {sessions.map(session => (
                 <button
                   key={session.id}
                   onClick={() => loadSession(session)}
                   className={`w-full text-left group flex items-start justify-between gap-2 px-3 py-3 rounded-lg transition-colors ${
                     currentSessionId === session.id 
                       ? 'bg-ink-800/80 text-white' 
                       : 'text-ink-400 hover:bg-ink-800/30 hover:text-ink-200'
                   }`}
                 >
                   <div className="flex-1 min-w-0">
                     <div className="text-sm font-medium truncate">{session.title}</div>
                     <div className="text-[10px] text-ink-600 truncate">{new Date(session.updatedAt).toLocaleDateString()}</div>
                   </div>
                   <div 
                     onClick={(e) => deleteChatSession(e, session.id)}
                     className="opacity-0 group-hover:opacity-100 p-1 text-ink-600 hover:text-red-400 transition"
                   >
                     <Trash2 size={12} />
                   </div>
                 </button>
               ))}
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-ink-800 space-y-2">
           {/* PWA Install Button (Only visible if prompt is captured) */}
           {installPrompt && (
             <button 
               onClick={handleInstallApp}
               className="w-full flex items-center justify-center gap-2 p-2 rounded bg-ink-800 text-accent-light hover:bg-ink-700 hover:text-white text-sm transition font-medium"
             >
               <Smartphone size={16} /> Install App
             </button>
           )}
           
           <button onClick={downloadChat} className="w-full flex items-center justify-center gap-2 p-2 rounded hover:bg-ink-800 text-ink-400 hover:text-white text-sm transition">
             <Download size={16} /> Export Chat
           </button>
        </div>
    </>
  );

  return (
    <div className="flex h-screen bg-ink-950 text-ink-100 overflow-hidden font-sans">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-ink-800 bg-ink-900/50 backdrop-blur-sm z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-50 flex">
           <div className="w-64 bg-ink-900 h-full shadow-2xl flex flex-col border-r border-ink-800">
             <SidebarContent />
           </div>
           <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileHistory(false)} />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full">
        
        {/* Header */}
        <header className="h-16 border-b border-ink-800 flex items-center justify-between px-4 md:px-8 bg-ink-950/80 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3">
             <button onClick={() => setShowMobileHistory(true)} className="md:hidden text-ink-400 hover:text-white">
               <Menu size={24} />
             </button>
             <div className="flex flex-col">
               <h1 className="font-serif font-bold text-lg text-ink-100 flex items-center gap-2">
                 {mode === AppMode.CHAT && <><Sparkles size={16} className="text-accent" /> Creative Assistant</>}
                 {mode === AppMode.STORY && <><BookOpen size={16} className="text-accent" /> Story Weaver</>}
                 {mode === AppMode.RESEARCH && <><Search size={16} className="text-accent" /> Trope Hunter</>}
                 {mode === AppMode.CHARACTER && <><Users size={16} className="text-accent" /> Character Workshop</>}
               </h1>
               <span className="text-xs text-ink-500 hidden sm:block">
                 {mode === AppMode.RESEARCH ? "Connected to Google Search" : `${settings.genre} • ${settings.pov}`}
               </span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-accent text-white' : 'hover:bg-ink-800 text-ink-400'}`}
              title="Story Settings"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </header>

        {/* Content Area Switcher */}
        {mode === AppMode.CHARACTER ? (
          <CharacterBuilder settings={settings} />
        ) : (
          <>
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 md:px-16 scroll-smooth">
              <div className="max-w-4xl mx-auto min-h-full pb-20">
                {messages.map((msg, idx) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    isLast={idx === messages.length - 1}
                    onRegenerate={handleRegenerate}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent shrink-0">
              <div className="max-w-4xl mx-auto relative bg-ink-800 rounded-2xl shadow-lg border border-ink-700/50 flex flex-col">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === AppMode.RESEARCH 
                    ? "Search for fandom tropes, historical accuracy, or platform trends..."
                    : "Type a prompt, a plot point, or ask for a scene..."
                  }
                  className="w-full bg-transparent text-white p-4 pr-12 rounded-2xl resize-none focus:outline-none max-h-48 overflow-y-auto"
                  style={{ minHeight: '60px' }}
                />
                
                <div className="absolute right-2 bottom-3">
                  <button 
                    onClick={handleSend} 
                    disabled={isLoading || !inputText.trim()}
                    className={`p-2 rounded-full transition-all ${
                      isLoading || !inputText.trim() 
                      ? 'bg-ink-700 text-ink-500' 
                      : 'bg-accent hover:bg-accent-dark text-white shadow-lg shadow-accent/20'
                    }`}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-center text-ink-600 text-xs mt-3">
                InkWeaver may produce inaccurate information.
              </p>
            </div>
          </>
        )}

        {/* Settings Slide-over */}
        <SettingsPanel 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)}
          settings={settings}
          setSettings={setSettings}
        />
      </main>
    </div>
  );
}

export default App;
