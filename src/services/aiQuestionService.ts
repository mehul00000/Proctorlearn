import { GoogleGenAI, Type } from "@google/genai";
import { ModuleId, Question } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function generateAIQuestions(moduleId: ModuleId, count: number = 3, excludedIds: string[] = []): Promise<Question[]> {
  const moduleContext: Record<ModuleId, string> = {
    'aptitude': 'Quantitative, Logical, and Verbal ability for placement exams',
    'dsa': 'Data Structures and Algorithms for tech interviews',
    'dbms': 'Database Management Systems, SQL, and Normalization',
    'cs-core': 'Operating Systems, Computer Networks, and OOP Concepts'
  };

  const prompt = `Generate ${count} unique multiple-choice questions for the topic: ${moduleContext[moduleId]}. 
  The questions should be challenging and suitable for a placement preparation platform.
  Avoid these specific question concepts or IDs if possible: ${excludedIds.join(', ')}.
  Return the response as a JSON array of objects following the Question interface.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "A unique ID for the question, e.g., 'ai_apt_101'" },
              text: { type: Type.STRING, description: "The question text" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Four multiple-choice options"
              },
              correctAnswer: { 
                type: Type.INTEGER, 
                description: "The index (0-3) of the correct option" 
              },
              explanation: { type: Type.STRING, description: "A brief explanation of the correct answer" }
            },
            required: ["id", "text", "options", "correctAnswer"]
          }
        }
      }
    });

    const questions = JSON.parse(response.text) as Question[];
    return questions;
  } catch (error) {
    console.error("AI Question Generation Error:", error);
    throw error;
  }
}
