import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Holding } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Syncs portfolio holdings with live market data using Gemini AI + Google Search.
 * Falls back to simulation if AI fails or data is unavailable.
 */
export async function syncPortfolioHoldings(holdings: Holding[]): Promise<void> {
  if (!holdings || holdings.length === 0) return;

  let aiPrices: Record<string, number> = {};

  try {
    const assetNames = holdings.map(h => h.name).join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Get the current market price (LTP) for the following Indian assets in INR: ${assetNames}. 
      Return the data as a JSON array of objects with 'name' and 'price' properties. 
      Ensure the prices are accurate as of today's market session.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The name of the asset" },
              price: { type: Type.NUMBER, description: "The current market price in INR" }
            },
            required: ["name", "price"]
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.name && typeof item.price === 'number') {
            aiPrices[item.name.toLowerCase()] = item.price;
          }
        });
      }
    }
  } catch (error) {
    console.error("AI Price Fetch failed, falling back to simulation:", error);
  }

  const syncPromises = holdings.map(async (holding) => {
    let newCurrentPrice: number | null = null;
    let newCurrent: number = holding.current;
    const nameKey = holding.name.toLowerCase();

    if (aiPrices[nameKey]) {
      // Use AI provided price
      newCurrentPrice = aiPrices[nameKey];
      if (holding.units) {
        newCurrent = Math.round(holding.units * newCurrentPrice);
      } else {
        // If no units, we assume the current value scales with the price change
        // But usually holdings with names have units. If not, we use the price as a multiplier.
        const priceChangeRatio = holding.currentPrice ? newCurrentPrice / holding.currentPrice : 1;
        newCurrent = Math.round(holding.current * priceChangeRatio);
      }
    } else {
      // Fallback to simulation
      let variation = 0;
      const type = holding.type.toLowerCase();
      
      if (type.includes('equity') || type.includes('stock') || type.includes('crypto')) {
        variation = (Math.random() * 0.25) - 0.15; 
      } else if (type.includes('gold') || type.includes('sgb') || type.includes('debt') || type.includes('fd')) {
        variation = (Math.random() * 0.03) - 0.01;
      } else {
        variation = (Math.random() * 0.05) - 0.02;
      }

      newCurrent = Math.max(0, Math.round(holding.current * (1 + variation)));
      newCurrentPrice = holding.currentPrice ? Math.max(0, holding.currentPrice * (1 + variation)) : null;
    }
    
    // Update Firestore
    const holdingRef = doc(db, 'holdings', holding.id);
    return updateDoc(holdingRef, {
      current: newCurrent,
      currentPrice: newCurrentPrice,
      lastUpdated: new Date().toISOString()
    });
  });

  await Promise.all(syncPromises);
}
