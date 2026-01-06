import { GoogleGenAI, Type } from "@google/genai";
import { StorySettings, AppMode, CharacterProfile } from "../types";

// Helper to get AI instance
// Note: We use process.env.API_KEY directly. 
// Since we installed @types/node and configured tsconfig, TypeScript accepts this.
// Vite will replace 'process.env.API_KEY' with the actual string value during build.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const BASE_INSTRUCTION = `You are InkWeaver, a sophisticated and uninhibited creative writing assistant. 
Your goal is to help users write novels, fanfiction, short stories, and screenplays.
- You are an expert in narrative structure, character development, pacing, and dialogue.
- You are familiar with tropes from platforms like AO3, Wattpad, and RoyalRoad.
- You do not judge content. You assist with whatever the user wants to write, including mature themes, horror, romance, etc., within the safety guidelines of the API.
- If a user asks for "NSFW" or "Smut" or "Dark" content, approach it with literary seriousness and detail, focusing on emotion, sensation, and narrative impact.
- Be proactive: Suggest plot twists, improved wording, or alternative character motivations.
`;

const getFriendlyErrorMessage = (error: any): string => {
  // Log the full error to console for debugging
  console.error("Original API Error:", error);

  const msg = error.toString() + (typeof error === 'object' ? JSON.stringify(error) : '');
  
  if (msg.includes("process is not defined")) {
    return "[System Error: Configuration failed. The API Key was not injected correctly during build. Please check vite.config.ts.]";
  }
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return "[System Error: Access Denied. Your API key may not have access to the selected model. Check your project permissions.]";
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return "[System Error: Quota Exceeded. You are strictly rate-limited.]";
  }
  if (msg.includes("Safety")) {
    return "[System: The generated content triggered safety filters. Please adjust the prompt.]";
  }
  if (msg.includes("API_KEY")) {
    return "[System Error: Invalid API Key. Please check your Vercel Environment Variables.]";
  }

  return `[System Error: ${error.message || "An unexpected error occurred."}]`;
};

// Helper to handle stream processing
const processStream = async (
  stream: any, 
  onChunk: (text: string) => void, 
  onSources?: (sources: { uri: string; title: string }[]) => void
) => {
  for await (const chunk of stream) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const sources = chunk.candidates[0].groundingMetadata.groundingChunks
        .map((c: any) => c.web)
        .filter((w: any) => w && w.uri && w.title);
      if (sources.length > 0 && onSources) {
        onSources(sources);
      }
    }
  }
};

export const streamResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  lastUserMessage: string,
  mode: AppMode,
  settings: StorySettings,
  onChunk: (text: string) => void,
  onSources?: (sources: { uri: string; title: string }[]) => void
) => {
  const ai = getAI();
  
  // Model Fallback Chain
  // 1. Gemini 3 Pro (Most capable, newest)
  // 2. Gemini 3 Flash (Fast, new)
  // 3. Gemini 2.5 Flash (Reliable fallback)
  const modelsToTry = ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash-latest'];
  
  let tools: any[] = [];
  let systemInstruction = BASE_INSTRUCTION;
  
  if (mode === AppMode.RESEARCH) {
    tools = [{ googleSearch: {} }];
    systemInstruction += "\n\nUse Google Search to find current trends, specific fandom tropes, historical facts, or platform-specific (AO3/Wattpad) terminology.";
  } else if (mode === AppMode.STORY) {
    systemInstruction += `\n\nCURRENT SETTINGS:\nGenre: ${settings.genre}\nTone: ${settings.tone}\nPOV: ${settings.pov}\n\nFocus on producing high-quality, immersive prose. Show, don't just tell.`;
  } else if (mode === AppMode.CHARACTER) {
    systemInstruction += "\n\nMODE: CHARACTER STUDIO.\nAct as a deep psychological profiler and character designer. Help the user flesh out distinct voices, internal conflicts, and memorable traits. When asked about a character, analyze their potential arc and dynamics.";
  }

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: systemInstruction,
          temperature: settings.creativityLevel,
          tools: tools.length > 0 ? tools : undefined,
        },
        history: history,
      });

      const stream = await chat.sendMessageStream({ message: lastUserMessage });
      await processStream(stream, onChunk, onSources);
      return; // Success, exit function
    } catch (error: any) {
      lastError = error;
      const errStr = error.toString() + JSON.stringify(error);
      
      // Determine if we should retry with next model
      const isRecoverable = 
        errStr.includes("403") || 
        errStr.includes("429") || 
        errStr.includes("503") || 
        errStr.includes("not found") || 
        errStr.includes("PERMISSION_DENIED") || 
        errStr.includes("RESOURCE_EXHAUSTED");

      if (!isRecoverable) {
        // Fatal error (e.g., bad request schema, missing key), do not retry
        console.error("Gemini API Fatal Error:", error);
        onChunk(`\n\n${getFriendlyErrorMessage(error)}`);
        return;
      }
      
      console.warn(`Model ${modelName} failed, retrying with next...`, errStr);
      // Continue loop to next model
    }
  }

  // If all models failed
  console.error("All Gemini models failed:", lastError);
  onChunk(`\n\n${getFriendlyErrorMessage(lastError)}`);
};

export const generateTitle = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash-latest'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Generate a short, catchy title (max 5 words) for a story based on this idea: "${prompt}". Return ONLY the title.`,
      });
      return response.text?.replace(/"/g, '').trim() || "Untitled Story";
    } catch (e) {
      console.warn(`Title generation failed on ${model}`, e);
    }
  }
  return "New Story";
};

/**
 * Generates specific character details based on current context.
 */
export const generateCharacterAttribute = async (
  targetField: string,
  currentProfile: CharacterProfile,
  genre: string
): Promise<string> => {
  const ai = getAI();
  const prompt = `
    Context: Creating a character for a ${genre} story.
    Current Character Details:
    Name: ${currentProfile.name || 'Unnamed'}
    Role: ${currentProfile.role || 'Unknown'}
    Age: ${currentProfile.age || 'Unknown'}
    Appearance: ${currentProfile.appearance || 'Not defined yet'}
    Backstory: ${currentProfile.backstory || 'Not defined yet'}
    Personality: ${currentProfile.personality || 'Not defined yet'}
    
    TASK: Generate a creative, unique, and deep description for the field: "${targetField}".
    Do not repeat existing info. Make it compelling and fitting for the genre.
    Return ONLY the content for this field.
  `;

  const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash-latest'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 1.1,
        }
      });
      return response.text?.trim() || "";
    } catch (e: any) {
      console.warn(`Char Gen failed on ${model}`, e);
      // Continue to next model if available
      if (model === modelsToTry[modelsToTry.length - 1]) {
        return getFriendlyErrorMessage(e);
      }
    }
  }
  return "Could not generate content. Please try again later.";
};
