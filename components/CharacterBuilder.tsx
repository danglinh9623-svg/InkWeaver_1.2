import React, { useState, useEffect } from 'react';
import { CharacterProfile, StorySettings } from '../types';
import { generateCharacterAttribute } from '../services/geminiService';
import { 
  Users, 
  Plus, 
  Save, 
  Trash2, 
  Copy, 
  Sparkles, 
  RefreshCw,
  ChevronRight,
  UserCircle
} from 'lucide-react';

interface CharacterBuilderProps {
  settings: StorySettings;
}

const EMPTY_CHAR: CharacterProfile = {
  id: '',
  name: '',
  role: 'Protagonist',
  age: '',
  appearance: '',
  backstory: '',
  personality: '',
  goals: '',
  relationships: '',
  notes: ''
};

const CharacterBuilder: React.FC<CharacterBuilderProps> = ({ settings }) => {
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CharacterProfile>(EMPTY_CHAR);
  const [loadingField, setLoadingField] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('inkweaver_characters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCharacters(parsed);
        if (parsed.length > 0) {
          selectCharacter(parsed[0]);
        } else {
          createNew();
        }
      } catch (e) {
        createNew();
      }
    } else {
      createNew();
    }
  }, []);

  // Save to local storage whenever list changes
  useEffect(() => {
    if (characters.length > 0) {
      localStorage.setItem('inkweaver_characters', JSON.stringify(characters));
    }
  }, [characters]);

  const selectCharacter = (char: CharacterProfile) => {
    setActiveCharId(char.id);
    setFormData(char);
  };

  const createNew = () => {
    const newChar: CharacterProfile = { 
      ...EMPTY_CHAR, 
      id: Date.now().toString(),
      name: 'New Character' 
    };
    setCharacters(prev => [...prev, newChar]);
    selectCharacter(newChar);
  };

  const saveCurrent = () => {
    if (!activeCharId) return;
    setCharacters(prev => prev.map(c => c.id === activeCharId ? formData : c));
    // Optional visual feedback
  };

  const deleteCurrent = () => {
    if (!activeCharId) return;
    const newList = characters.filter(c => c.id !== activeCharId);
    setCharacters(newList);
    if (newList.length > 0) {
      selectCharacter(newList[0]);
    } else {
      createNew();
    }
  };

  const copyToClipboard = () => {
    const text = `
    Name: ${formData.name}
    Role: ${formData.role} (${formData.age})
    
    APPEARANCE:
    ${formData.appearance}
    
    PERSONALITY:
    ${formData.personality}
    
    BACKSTORY:
    ${formData.backstory}
    
    GOALS:
    ${formData.goals}
    
    RELATIONSHIPS:
    ${formData.relationships}
    `.trim();
    navigator.clipboard.writeText(text);
  };

  const handleChange = (field: keyof CharacterProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-save form data to list on blur or periodically is tricky with state sync
  // So we explicitly save when switching or clicking save. 
  // However, to keep list updated in real-time for names:
  useEffect(() => {
    if (activeCharId) {
      setCharacters(prev => prev.map(c => c.id === activeCharId ? formData : c));
    }
  }, [formData.name, formData.role]); // Only sync basics automatically

  const generateContent = async (field: keyof CharacterProfile) => {
    if (loadingField) return;
    setLoadingField(field);
    try {
      const result = await generateCharacterAttribute(field, formData, settings.genre);
      setFormData(prev => ({ 
        ...prev, 
        [field]: prev[field] ? prev[field] + '\n\n' + result : result 
      }));
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <div className="flex h-full bg-ink-950 overflow-hidden">
      
      {/* List Sidebar */}
      <div className="w-64 bg-ink-900 border-r border-ink-800 flex flex-col">
        <div className="p-4 border-b border-ink-800 flex justify-between items-center">
          <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider">My Characters</h2>
          <button onClick={createNew} className="text-accent hover:text-white transition">
            <Plus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {characters.map(char => (
            <button
              key={char.id}
              onClick={() => selectCharacter(char)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                activeCharId === char.id 
                  ? 'bg-ink-800 border border-ink-700 text-white' 
                  : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activeCharId === char.id ? 'bg-accent text-white' : 'bg-ink-700'}`}>
                <UserCircle size={16} />
              </div>
              <div className="truncate">
                <div className="font-medium text-sm truncate">{char.name || 'Unnamed'}</div>
                <div className="text-xs text-ink-500 truncate">{char.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-ink-950">
        
        {/* Toolbar */}
        <div className="h-14 border-b border-ink-800 flex items-center justify-between px-6 bg-ink-900/50">
          <div className="flex items-center gap-2 text-sm text-ink-400">
             <span className="hidden md:inline">Character Studio</span>
             <ChevronRight size={14} />
             <span className="text-white font-medium">{formData.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveCurrent} className="p-2 text-ink-400 hover:text-accent transition" title="Save Changes">
              <Save size={18} />
            </button>
            <button onClick={copyToClipboard} className="p-2 text-ink-400 hover:text-white transition" title="Copy to Clipboard">
              <Copy size={18} />
            </button>
            <button onClick={deleteCurrent} className="p-2 text-ink-400 hover:text-red-500 transition" title="Delete Character">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            
            {/* Header Identity */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
               <div className="md:col-span-6">
                 <label className="block text-xs font-bold text-ink-500 uppercase mb-2">Full Name</label>
                 <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 text-white text-xl p-3 rounded-lg focus:ring-2 focus:ring-accent outline-none font-serif"
                    placeholder="E.g. Elara Vance"
                 />
               </div>
               <div className="md:col-span-4">
                 <label className="block text-xs font-bold text-ink-500 uppercase mb-2">Role/Archetype</label>
                 <input 
                    type="text" 
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 text-ink-200 p-3 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                    placeholder="Protagonist, Villain..."
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-ink-500 uppercase mb-2">Age</label>
                 <input 
                    type="text" 
                    value={formData.age}
                    onChange={(e) => handleChange('age', e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 text-ink-200 p-3 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                    placeholder="24"
                 />
               </div>
            </div>

            {/* Large Text Areas with AI Gen */}
            {[
              { id: 'appearance', label: 'Appearance', placeholder: 'Distinctive features, clothing style, demeanor...' },
              { id: 'personality', label: 'Personality & Psyche', placeholder: 'Strengths, weaknesses, fears, MBTI, quirks...' },
              { id: 'backstory', label: 'Backstory', placeholder: 'Origin, trauma, key life events...' },
              { id: 'goals', label: 'Goals & Motivation', placeholder: 'What do they want? What stands in their way?' },
              { id: 'relationships', label: 'Relationships', placeholder: 'Family, rivals, love interests...' }
            ].map((field) => (
              <div key={field.id} className="relative group">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-ink-500 uppercase">{field.label}</label>
                  <button 
                    onClick={() => generateContent(field.id as keyof CharacterProfile)}
                    disabled={!!loadingField}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-all ${
                      loadingField === field.id 
                        ? 'bg-ink-800 text-ink-500 border-ink-800' 
                        : 'bg-ink-800/50 text-accent border-accent/30 hover:bg-accent hover:text-white'
                    }`}
                  >
                     {loadingField === field.id ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                     <span>{loadingField === field.id ? 'Thinking...' : 'Inspire Me'}</span>
                  </button>
                </div>
                <textarea
                  value={(formData as any)[field.id]}
                  onChange={(e) => handleChange(field.id as keyof CharacterProfile, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-ink-900/50 border border-ink-800 text-ink-200 p-4 rounded-lg focus:ring-2 focus:ring-accent outline-none min-h-[120px] leading-relaxed resize-y"
                />
              </div>
            ))}

            <div className="pt-8 border-t border-ink-800">
               <label className="block text-xs font-bold text-ink-500 uppercase mb-2">Private Notes</label>
               <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Drafting ideas, alternate names, future plot points..."
                  className="w-full bg-ink-950 border border-dashed border-ink-800 text-ink-400 p-4 rounded-lg focus:border-accent outline-none min-h-[100px]"
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterBuilder;
