import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Helper to clean JSON string from potential markdown wrappers
 */
function cleanJson(text: string): string {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\n?|```/g, "").trim();
  
  // Find the first [ and last ] to extract the array
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  
  return cleaned;
}

export async function getFinancialInsights(userData: any, forceRefresh = false) {
  if (!apiKey) return ["Gemini API key is not configured. Please add it to the Secrets panel."];

  // Check cache first
  const cacheKey = 'wealthos_insights_cache';
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData && !forceRefresh) {
    const { timestamp, insights } = JSON.parse(cachedData);
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - timestamp < oneHour) {
      return insights;
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a highly experienced Indian Chartered Financial Analyst (CFA) and Wealth Manager. 
      Analyze the user's financial data and provide 4-5 high-impact, actionable insights.
      
      CRITICAL TASKS:
      1. Compare current month spending with last month. If any category or overall spending increased significantly, point it out and suggest how to cut back.
      2. Analyze their savings rate. If it's below 30%, provide a specific plan to reach it.
      3. Based on their age (${userData.age}) and net worth, suggest 1-2 specific Indian financial products (e.g., specific Mutual Fund types like Index Funds or Mid-cap, PPF, NPS, or Term Insurance) that they should consider.
      4. Provide a "Tax Hack" based on Section 80C, 80D, or the New vs Old Tax Regime.
      5. Goal-Linked Micro-Investing: Strongly link their highest discretionary expense to their actual defined goals (from data). Say exactly "If you cut ₹X from [Category] this month, you will reach your [Goal Name] goal Y days/months faster!"

      Data: ${JSON.stringify(userData)}
      
      Format: Return a JSON array of strings. Each string should be a concise, punchy insight with emojis.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "A list of financial insights and recommendations"
        }
      }
    });

    const text = response.text || "[]";
    let insights = [];
    try {
      insights = JSON.parse(cleanJson(text));
    } catch (parseError) {
      console.error("JSON Parse Error after cleaning:", parseError, "Original text:", text);
      // Fallback if cleaning fails
      insights = JSON.parse(text.match(/\[.*\]/s)?.[0] || "[]");
    }

    // Update cache
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      insights
    }));

    return insights;
  } catch (error: any) {
    console.error("Error getting insights:", error);
    
    // If we have cached data, return it even if expired when API fails
    if (cachedData) {
      const { insights } = JSON.parse(cachedData);
      return insights;
    }

    if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
      return [
        "We're receiving a lot of requests right now. Please try again in a few minutes.",
        "In the meantime, review your monthly budget for any missed savings.",
        "Check your recurring transactions to ensure they are all necessary."
      ];
    }

    return [
      "Analyze your spending to find saving opportunities.",
      "Consider diversifying your portfolio for better risk management.",
      "Review your tax-saving investments before the financial year ends."
    ];
  }
}

export async function chatWithInvxtra(
  message: string, 
  history: { role: string, text: string }[], 
  userData: any,
  persona: string = 'Financial Advisor',
  priorities: string[] = []
) {
  if (!apiKey) return "Gemini API key is not configured.";

  try {
    const priorityText = priorities.length > 0 ? `Prioritize analyzing and discussing these areas: ${priorities.join(', ')}.` : '';
    
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are invxtra AI, acting as a professional Indian ${persona}. 
        You have access to the user's financial data: ${JSON.stringify(userData)}.
        ${priorityText}
        Provide personalized, encouraging, and accurate financial advice based on Indian regulations, tax laws (Old vs New Regime), and investment options (Mutual Funds, FD, RD, PPF, NPS, Gold, Real Estate).
        Keep responses concise, professional yet friendly, and use emojis where appropriate. 🇮🇳
        IMPORTANT: If the user asks for a breakdown, chart, or visual representation of their data, you must output a specific tag like [PIE_CHART: {"data": [{"name":"Category","value":100}]}] exactly like this anywhere in your response, so the UI can render a live React chart. Do not wrap the JSON inside the tag with markdown block quotes.`,
      },
    });

    // We need to map history to the format expected by sendMessage if we were using a more complex chat state,
    // but for simplicity we'll just send the message.
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting right now. How else can I help you with your finances?";
  }
}

export async function autoCategorizeTransactions(rawTransactions: { date: string, description: string, amount: number }[]) {
  if (!apiKey) return rawTransactions.map(t => ({ ...t, category: 'Others', name: t.description, emoji: '🏷️' }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an AI that categorizes raw bank transactions.
      Given the following list of raw transactions, clean up the 'description' to a user-friendly 'name', choose an appropriate 'category' (e.g., Dining, Groceries, Shopping, Travel, Bills, Entertainment, Salary, Others), and provide a fitting 'emoji'.
      If amount is negative, it's an expense. If positive, it's income.
      
      Raw Data: ${JSON.stringify(rawTransactions)}
      
      Return a JSON array of objects with keys: name, category, emoji. Maintain the exact same order.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              emoji: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    return JSON.parse(cleanJson(text));
  } catch (error) {
    console.error("Auto-categorize error:", error);
    return rawTransactions.map(t => ({ ...t, category: 'Others', name: t.description, emoji: '🏷️' }));
  }
}

export async function generateNegotiationEmail(serviceName: string, currentRate: number) {
  if (!apiKey) return "API key missing.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a polite, professional, and firm email to ${serviceName} customer support. 
      I currently pay ₹${currentRate} per month. 
      The goal is to negotiate a lower rate, mentioning that I am considering switching to a competitor due to cost, but I have been a loyal customer and would prefer to stay if they can offer a promotional discount or match competitor pricing.
      Keep it concise and ready to send. Don't include subject line.`,
    });
    return response.text;
  } catch (error) {
    console.error("Negotiation email error:", error);
    return "Could not generate email at this time.";
  }
}
