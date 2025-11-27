import { GoogleGenAI, Type } from "@google/genai";
import { ScriptData, Scene, Beat, Shot, Asset } from "../types";

const getAI = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Step 1: Analyze Novel -> Extract Assets & Script (Scenes -> Beats)
 */
export const analyzeNovel = async (text: string): Promise<ScriptData> => {
  const ai = getAI();
  
  const systemInstruction = `
    You are a professional Screenwriter and Cinematographer.
    Analyze the provided novel text.
    
    1. EXTRACT ASSETS: Identify key characters and locations. Provide a 'visualDescription' for each that is consistent and detailed.
    2. WRITE SCRIPT: 
       - Break the narrative into SCENES based on location or time changes.
       - Give each scene a proper SLUGLINE (e.g., "INT. APARTMENT - DAY").
       - Inside each scene, break the action down into narrative BEATS.
    
    Output JSON.
  `;

  const safeText = text.substring(0, 15000);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: safeText }] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            genre: { type: Type.STRING },
            logline: { type: Type.STRING },
            assets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['CHARACTER', 'LOCATION', 'PROP'] },
                  visualDescription: { type: Type.STRING },
                }
              }
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  slugline: { type: Type.STRING },
                  beats: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        description: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    let jsonString = response.text || "{}";
    if (jsonString.includes("```")) {
        jsonString = jsonString.replace(/^```(json)?|```$/g, "").trim();
    }
    const parsed = JSON.parse(jsonString);

    // Sanitize and ensure structure
    const safeScenes = Array.isArray(parsed.scenes) ? parsed.scenes.map((scene: any, sIdx: number) => ({
        id: scene.id || `scene_${sIdx}`,
        slugline: scene.slugline || "UNKNOWN SCENE",
        isExpanded: true, // Auto expand first level
        beats: Array.isArray(scene.beats) ? scene.beats.map((beat: any, bIdx: number) => ({
            id: beat.id || `beat_${sIdx}_${bIdx}`,
            description: beat.description || "",
            shots: []
        })) : []
    })) : [];

    return {
        title: parsed.title || "Untitled",
        genre: parsed.genre || "Drama",
        logline: parsed.logline || "",
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        scenes: safeScenes
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

/**
 * Step 2: Break a Beat down into Shots (Cinematography)
 */
export const generateShotsForBeat = async (beat: Beat, sceneSlugline: string, assets: Asset[]): Promise<Shot[]> => {
    const ai = getAI();

    const assetsContext = assets.map(a => `${a.id} (${a.name}): ${a.visualDescription}`).join('\n');
    
    const prompt = `
      Context - Assets available:
      ${assetsContext}

      Scene Context: ${sceneSlugline}
      
      Current Beat:
      ${beat.description}

      Task:
      Break this beat down into 3-5 cinematic shots.
      For each shot:
      1. Define the 'shotType' (e.g., Extreme Close Up, Wide Shot, Low Angle).
      2. Write a 'visualPrompt'. CRITICAL: You MUST include the physical descriptions of the specific Assets (Characters/Locations) visible in the shot to ensure they look consistent.
      3. List the 'assetIds' of the assets visible in this shot.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            shotType: { type: Type.STRING },
                            visualPrompt: { type: Type.STRING },
                            action: { type: Type.STRING },
                            assetIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                }
            }
        });

        const shots = JSON.parse(response.text || "[]");
        return shots.map((s: any, i: number) => ({...s, id: s.id || `shot_${Date.now()}_${i}`}));
    } catch (error) {
        console.error("Shot Generation Error", error);
        throw error;
    }
}

/**
 * Step 3: Generate Image
 */
export const generateShotImage = async (visualPrompt: string): Promise<string> => {
  const ai = getAI();
  const enhancedPrompt = `${visualPrompt}, cinematic lighting, 8k resolution, photorealistic, film grain, color graded.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: [{ text: enhancedPrompt }] }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

/**
 * Step 4: Generate Video (Veo)
 */
export const generateShotVideo = async (shot: Shot, imageBase64?: string): Promise<string> => {
  // @ts-ignore
  if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
     // @ts-ignore
     await window.aistudio.openSelectKey();
  }

  const ai = getAI(); 
  const cleanBase64 = imageBase64 ? imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '') : undefined;
  
  let operation;
  const prompt = `${shot.visualPrompt}, ${shot.shotType}, cinematic movement: ${shot.action}, 4k, slow motion`;

  try {
      if (cleanBase64) {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            image: { imageBytes: cleanBase64, mimeType: 'image/png' },
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
      } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
      }

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation});
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("Video generation failed");

      return `${videoUri}&key=${process.env.API_KEY}`;
  } catch (error) {
      console.error("Veo Error:", error);
      throw error;
  }
};
