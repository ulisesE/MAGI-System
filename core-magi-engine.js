// MAGI Personal System - Core Engine Module
// Manages global state, consensus prompts, and Gemini API query requests.

// Global state container
window.state = {
  geminiKey: localStorage.getItem('MAGI_GEMINI_KEY') || '',
  geminiModel: localStorage.getItem('MAGI_GEMINI_MODEL') || 'gemini-1.5-flash',
  supabaseUrl: localStorage.getItem('MAGI_SUPABASE_URL') || '',
  supabaseKey: localStorage.getItem('MAGI_SUPABASE_KEY') || '',
  econMode: localStorage.getItem('MAGI_ECON_MODE') === 'true',
  history: [],
  cache: JSON.parse(localStorage.getItem('MAGI_DECISION_CACHE') || '{}'), // Persistent cache
  obedienceCached: null // Memoized obedience metrics
};

// Compact, Token-Optimized System Prompt (~65 tokens max)
window.UNIFIED_MAGI_PROMPT = `MAGI Engine. Evalúa propuesta.
Cores: Melchior (lógica/costo), Balthasar (empatía/salud), Casper (deseo/pasión).
Consenso: APPROVED si >=2 cores votan SI, sino REJECTED.
Responde JSON (reasoning en español, max 100 chars):
{"melchior":{"vote":"SI"|"NO","confidence":0-100,"reasoning":"str"},"balthasar":{"vote":"SI"|"NO","confidence":0-100,"reasoning":"str"},"casper":{"vote":"SI"|"NO","confidence":0-100,"reasoning":"str"},"consensus":{"final_decision":"APPROVED"|"REJECTED","summary":"str","decisive_factor":"str"}}`;

// Robust JSON Parsing to handle LLM markdown code blocks and curly quotes
window.parseRobustJson = function(text) {
  let cleaned = text.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (subErr) {
        console.warn("Isolating brace syntax failed. Cleaning quotes...", subErr);
      }
    }

    let sanitized = cleaned
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const firstBrace2 = sanitized.indexOf('{');
    const lastBrace2 = sanitized.lastIndexOf('}');
    if (firstBrace2 !== -1 && lastBrace2 !== -1 && lastBrace2 > firstBrace2) {
      try {
        return JSON.parse(sanitized.substring(firstBrace2, lastBrace2 + 1));
      } catch (finalErr) {
        console.error("All cleaning passes failed. Raw string:", text);
      }
    }

    throw new Error("La respuesta de la IA no contiene un formato JSON válido.");
  }
};

// Helper to query Gemini API (Unified Single Call)
window.queryGemini = async function(systemPrompt, userPrompt, modelOverride = null) {
  const model = modelOverride || state.geminiModel || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.geminiKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      ...(state.econMode ? { maxOutputTokens: 250, temperature: 0.2 } : {})
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error del servidor (${response.status})`);
  }

  const resJson = await response.json();
  const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Respuesta vacía de Gemini");
  }

  return parseRobustJson(rawText);
};
