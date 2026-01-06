export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
  groundingSources?: { uri: string; title: string; }[];
}

export enum AppMode {
  CHAT = 'CHAT',
  STORY = 'STORY',
  RESEARCH = 'RESEARCH',
  CHARACTER = 'CHARACTER'
}

export interface StorySettings {
  genre: string;
  tone: string;
  pov: string;
  creativityLevel: number;
}

export interface CharacterProfile {
  id: string; name: string; role: string; age: string;
  appearance: string; backstory: string; personality: string;
  goals: string; relationships: string; notes: string;
}

export interface ChatSession {
  id: string; title: string; messages: Message[];
  mode: AppMode; settings: StorySettings; updatedAt: number; preview: string;
}
