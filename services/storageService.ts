import { ChatSession } from '../types';

const STORAGE_KEY = 'inkweaver_sessions';

export const getSessions = (): ChatSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
};

export const saveSession = (session: ChatSession) => {
  const sessions = getSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  
  // Sort by newest first
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  
  // Limit to 50 sessions to save space
  const trimmed = sessions.slice(0, 50);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
};

export const deleteSession = (sessionId: string): ChatSession[] => {
  const sessions = getSessions();
  const newSessions = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  return newSessions;
};

export const getSessionById = (sessionId: string): ChatSession | undefined => {
  const sessions = getSessions();
  return sessions.find(s => s.id === sessionId);
};
