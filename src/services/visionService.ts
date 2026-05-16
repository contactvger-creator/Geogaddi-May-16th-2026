import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeGeogaddiImage(base64Image: string): Promise<string> {
  const prompt = `
    TASK: DECODE GEOGADDI OPTICAL DATA RINGS
    
    This image contains a cryptographic fingerprint with high-density data rings at the outer edge.
    You must perform a forensic color analysis of these rings to extract the cipher stream.
    
    COLOR MAPPING (3 bits per block):
    - Black (#000000): 000
    - White (#FFFFFF): 001
    - Green (#00FF41): 010
    - Red (#FC3D21): 011
    - Blue (#0066FF): 100
    - Amber (#FFB800): 101
    - Purple (#D400FF): 110
    - Turquoise (#40E0D0): 111
    
    SCANNING PROTOCOL:
    1. Identify the center of the geoglyph.
    2. LOCATE THE CALIBRATION HEADER: At the very top (12 o'clock) of the outermost ring, there are 8 blocks representing the 8 reference colors in order. Use these to calibrate your color detection.
    3. LOCATE DATA START: Data begins immediately after these 8 calibration blocks on the outermost ring.
    4. SCANNING: Read clockwise. Once a ring is full, move to the next inner ring.
    5. DATA INTEGRITY: The geoglyph contains exactly the bits needed for the payload. If you detect visual noise, prioritize the color matching from the calibration blocks.
    6. Return the data as a Base64 encoded string and detect if a cartridge was required.
    
    OUTPUT FORMAT:
    Return ONLY a JSON object: 
    {
      "payload": "YOUR_BASE64_STRING",
      "requiresCartridge": true/false
    }
    If you cannot decode it, return {"error": "DATA_CORRUPTION"}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = response.text || "{}";
    return result.trim();
  } catch (error) {
    console.error("Vision Analysis Failed:", error);
    return JSON.stringify({ error: "AI_CONNECTION_FAILURE" });
  }
}
