import React from 'react';
import { Message, Role } from '../types';
import { User, Bot, Globe, RefreshCcw } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
  onRegenerate?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast, onRegenerate }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-ink-600 text-ink-200' : 'bg-accent text-white'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div 
            className={`px-5 py-4 rounded-2xl shadow-sm leading-relaxed whitespace-pre-wrap ${
              isUser 
                ? 'bg-ink-700 text-white rounded-tr-sm' 
                : 'bg-ink-800 text-ink-100 rounded-tl-sm border border-ink-700 font-serif'
            }`}
          >
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse align-middle"></span>
            )}
          </div>

          {/* Actions & Footer */}
          <div className="flex justify-between items-center mt-2 w-full">
            {/* Grounding Sources */}
            <div className="flex-1">
              {message.groundingSources && message.groundingSources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.groundingSources.map((source, idx) => (
                    <a 
                      key={idx}
                      href={source.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-ink-800/50 hover:bg-ink-700 border border-ink-700/50 rounded text-accent-light hover:text-accent transition truncate max-w-xs text-xs"
                    >
                      <Globe size={10} />
                      <span className="truncate max-w-[150px]">{source.title || 'Source'}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Regenerate Button (Only for last bot message) */}
            {!isUser && isLast && !message.isStreaming && onRegenerate && (
              <button 
                onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-ink-500 hover:text-accent transition-colors ml-2 px-2 py-1 rounded hover:bg-ink-800"
                title="Regenerate response"
              >
                <RefreshCcw size={12} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
