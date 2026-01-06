import React from 'react';
import { StorySettings } from '../types';
import { X, Sliders } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StorySettings;
  setSettings: React.Dispatch<React.SetStateAction<StorySettings>>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, setSettings }) => {
  if (!isOpen) return null;

  const handleChange = (key: keyof StorySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-ink-800 border-l border-ink-700 shadow-2xl transform transition-transform duration-300 z-50 p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-serif font-bold text-accent-light flex items-center gap-2">
          <Sliders size={20} />
          Story Config
        </h2>
        <button onClick={onClose} className="text-ink-400 hover:text-white transition">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Creativity/Temp */}
        <div>
          <label className="block text-sm font-medium text-ink-300 mb-2">
            Creativity (Temperature): {settings.creativityLevel}
          </label>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={settings.creativityLevel}
            onChange={(e) => handleChange('creativityLevel', parseFloat(e.target.value))}
            className="w-full h-2 bg-ink-600 rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-ink-500 mt-1">
            <span>Precise</span>
            <span>Balanced</span>
            <span>Wild</span>
          </div>
        </div>

        {/* Genre */}
        <div>
          <label className="block text-sm font-medium text-ink-300 mb-2">Genre</label>
          <select 
            value={settings.genre}
            onChange={(e) => handleChange('genre', e.target.value)}
            className="w-full bg-ink-900 border border-ink-600 text-white rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="General Fiction">General Fiction</option>
            <option value="Fantasy">Fantasy</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Romance">Romance</option>
            <option value="Fanfiction">Fanfiction</option>
            <option value="Horror">Horror</option>
            <option value="Mystery">Mystery</option>
            <option value="Erotica">Erotica (Mature)</option>
            <option value="Thriller">Thriller</option>
          </select>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-ink-300 mb-2">Tone</label>
          <select 
            value={settings.tone}
            onChange={(e) => handleChange('tone', e.target.value)}
            className="w-full bg-ink-900 border border-ink-600 text-white rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="Neutral">Neutral</option>
            <option value="Dark & Gritty">Dark & Gritty</option>
            <option value="Humorous">Humorous</option>
            <option value="Angsty">Angsty</option>
            <option value="Fluffy & Wholesome">Fluffy & Wholesome</option>
            <option value="Suspenseful">Suspenseful</option>
            <option value="Melancholic">Melancholic</option>
            <option value="Witty">Witty</option>
          </select>
        </div>

        {/* POV */}
        <div>
          <label className="block text-sm font-medium text-ink-300 mb-2">POV</label>
          <div className="grid grid-cols-3 gap-2">
            {['First Person', 'Third Limited', 'Third Omni'].map((p) => (
              <button
                key={p}
                onClick={() => handleChange('pov', p)}
                className={`text-xs py-2 px-1 rounded-md border ${
                  settings.pov === p 
                    ? 'bg-accent/20 border-accent text-accent-light' 
                    : 'bg-ink-900 border-ink-600 text-ink-400 hover:bg-ink-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-ink-900 rounded-lg border border-ink-700">
          <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Tips</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            For specific styles (e.g., "Wattpad style" or "Jane Austen style"), mention it directly in your chat prompt. These settings guide the underlying creative direction.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
