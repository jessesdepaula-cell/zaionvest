import OpenAI from "openai";

export function getAIClient(userKeys?: { geminiApiKey?: string | null; openaiApiKey?: string | null }) {
  const geminiApiKey = userKeys?.geminiApiKey || process.env.GEMINI_API_KEY;
  
  if (geminiApiKey) {
    return {
      openai: new OpenAI({
        apiKey: geminiApiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      isGemini: true,
    };
  }

  const openaiApiKey = userKeys?.openaiApiKey || process.env.OPENAI_API_KEY || "";
  return {
    openai: new OpenAI({
      apiKey: openaiApiKey,
    }),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    isGemini: false,
  };
}

