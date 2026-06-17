// MAGI Personal System Core Logic

// State management
const state = {
  geminiKey: localStorage.getItem('MAGI_GEMINI_KEY') || '',
  geminiModel: localStorage.getItem('MAGI_GEMINI_MODEL') || 'gemini-1.5-flash',
  supabaseUrl: localStorage.getItem('MAGI_SUPABASE_URL') || '',
  supabaseKey: localStorage.getItem('MAGI_SUPABASE_KEY') || '',
  history: []
};

// UI Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const geminiKeyInput = document.getElementById('geminiKey');
const geminiModelSelect = document.getElementById('geminiModel');
const supabaseUrlInput = document.getElementById('supabaseUrl');
const supabaseKeyInput = document.getElementById('supabaseKey');

const decisionForm = document.getElementById('decisionForm');
const consultBtn = document.getElementById('consultBtn');
const decisionText = document.getElementById('decisionText');
const categorySelect = document.getElementById('category');
const dateInput = document.getElementById('date');

const thinkingOverlay = document.getElementById('thinkingOverlay');
const emptyState = document.getElementById('emptyState');
const magiResult = document.getElementById('magiResult');

const statusMelchior = document.getElementById('status-melchior');
const statusBalthasar = document.getElementById('status-balthasar');
const statusCasper = document.getElementById('status-casper');

const consensusBadge = document.getElementById('consensusBadge');
const consensusValue = document.getElementById('consensusValue');
const consensusSummary = document.getElementById('consensusSummary');
const decisiveFactorEl = document.getElementById('decisiveFactor');

const obedienceRateEl = document.getElementById('obedienceRate');
const historyListEl = document.getElementById('historyList');

// Emotional Memory & Danger Alert Elements
const emotionalStateSelect = document.getElementById('emotionalState');
const dailyContextInput = document.getElementById('dailyContext');
const dangerPatternBanner = document.getElementById('dangerPatternBanner');
const dangerPatternText = document.getElementById('dangerPatternText');

// Profile Elements
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const profileLoading = document.getElementById('profileLoading');
const profileContent = document.getElementById('profileContent');
const profileStrengths = document.getElementById('profileStrengths');
const profileRisks = document.getElementById('profileRisks');
const profilePatterns = document.getElementById('profilePatterns');
const profileSummary = document.getElementById('profileSummary');

// Setup default date to today
dateInput.value = new Date().toISOString().split('T')[0];

// Initialization
function init() {
  if (state.geminiKey) {
    geminiKeyInput.value = state.geminiKey;
  }
  if (state.geminiModel) {
    geminiModelSelect.value = state.geminiModel;
  }
  if (state.supabaseUrl) {
    supabaseUrlInput.value = state.supabaseUrl;
  }
  if (state.supabaseKey) {
    supabaseKeyInput.value = state.supabaseKey;
  }

  if (!state.geminiKey) {
    toggleSettings(true);
  } else {
    loadHistory();
  }
}

// Event Listeners
settingsBtn.addEventListener('click', () => toggleSettings(true));
closeSettingsBtn.addEventListener('click', () => toggleSettings(false));
settingsForm.addEventListener('submit', handleSettingsSubmit);
decisionForm.addEventListener('submit', handleDecisionSubmit);

profileBtn.addEventListener('click', handleProfileClick);
closeProfileBtn.addEventListener('click', () => toggleProfile(false));

// Toggle Settings Modal
function toggleSettings(show) {
  if (show) {
    settingsModal.classList.remove('hidden');
  } else {
    settingsModal.classList.add('hidden');
  }
}

// Toggle Profile Modal
function toggleProfile(show) {
  if (show) {
    profileModal.classList.remove('hidden');
  } else {
    profileModal.classList.add('hidden');
  }
}

// Handle Settings Form Submit
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const gemini = geminiKeyInput.value.trim();
  const model = geminiModelSelect.value;
  const sbUrl = supabaseUrlInput.value.trim();
  const sbKey = supabaseKeyInput.value.trim();

  if (gemini) {
    state.geminiKey = gemini;
    localStorage.setItem('MAGI_GEMINI_KEY', gemini);
  }
  state.geminiModel = model;
  localStorage.setItem('MAGI_GEMINI_MODEL', model);
  state.supabaseUrl = sbUrl;
  state.supabaseKey = sbKey;
  localStorage.setItem('MAGI_SUPABASE_URL', sbUrl);
  localStorage.setItem('MAGI_SUPABASE_KEY', sbKey);

  // Dynamically load models permitted by the saved key
  await populateGeminiModels();

  toggleSettings(false);
  alert('Credenciales actualizadas.');
  loadHistory();
}

// Robust JSON Parsing to handle LLM quirks, markdown fences, and stray characters
function parseRobustJson(text) {
  let cleaned = text.trim();
  
  // 1. Clean markdown code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  cleaned = cleaned.trim();

  // 2. Direct Parse Attempt
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 3. Extract target JSON bounds by finding first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (subErr) {
        console.warn("Isolating brace syntax failed. Cleaning quotes...", subErr);
      }
    }

    // 4. Sanitize curly quotation characters that LLMs sometimes generate
    let sanitized = cleaned
      .replace(/[\u201C\u201D]/g, '"') // Unicode double curly quotes
      .replace(/[\u2018\u2019]/g, "'"); // Unicode single curly quotes

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
}

// Helper to update individual personality UI card
function updateMagiCard(cardId, data) {
  const card = document.getElementById(`card-${cardId}`);
  const voteEl = document.getElementById(`vote-${cardId}`);
  const reasonEl = document.getElementById(`reason-${cardId}`);
  const confEl = document.getElementById(`conf-${cardId}`);
  const progressEl = document.getElementById(`progress-${cardId}`);

  card.className = 'magi-card'; // reset
  const isYes = data.vote.toUpperCase() === 'SI';
  card.classList.add(isYes ? 'vote-si' : 'vote-no');

  voteEl.textContent = isYes ? 'SÍ' : 'NO';
  reasonEl.textContent = data.reasoning;
  confEl.textContent = data.confidence;
  progressEl.style.width = `${data.confidence}%`;
}

// Helper to query Gemini API (Unified Single Call)
async function queryGemini(systemPrompt, userPrompt) {
  const model = state.geminiModel || 'gemini-1.5-flash';
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
      responseMimeType: "application/json"
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
}

// Fetch historical memories for context injection, prioritizing category matching (FTS approximation)
async function getRecentMemoriesContext(category) {
  if (!state.supabaseUrl || !state.supabaseKey) return '';
  
  try {
    // 1. Query last 5 resolved decisions in the SAME category
    const categoryUrl = `${state.supabaseUrl}/rest/v1/memories?user_action=not.is.null&category=eq.${category}&order=created_at.desc&limit=5`;
    const response = await fetch(categoryUrl, {
      method: 'GET',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`
      }
    });
    
    let records = [];
    if (response.ok) {
      records = await response.json();
    }
    
    // 2. If we have fewer than 3 matching category records, supplement with recent records from other categories
    if (records.length < 3) {
      const generalUrl = `${state.supabaseUrl}/rest/v1/memories?user_action=not.is.null&category=neq.${category}&order=created_at.desc&limit=${5 - records.length}`;
      const generalResponse = await fetch(generalUrl, {
        method: 'GET',
        headers: {
          'apikey': state.supabaseKey,
          'Authorization': `Bearer ${state.supabaseKey}`
        }
      });
      if (generalResponse.ok) {
        const generalRecords = await generalResponse.json();
        records = records.concat(generalRecords);
      }
    }

    if (records.length === 0) return '';
    
    let contextText = "\n\nMEMORIA HISTÓRICA Y CONTEXTO EMOCIONAL DE ULISES:\n";
    records.forEach((rec, idx) => {
      contextText += `${idx+1}. [${rec.category}] Decisión: "${rec.decision}" | Estado emocional: ${rec.emotional_state || 'Calmado'} | Contexto del día: ${rec.daily_context || 'N/A'} | Recomendación MAGI: ${rec.consensus_vote} | Ulises decidió: ${rec.user_action === 'SI' ? 'Hacerlo' : 'No hacerlo'} | Consecuencia/Reflexión: "${rec.reflection || 'Sin comentarios'}"\n`;
    });
    contextText += "Utiliza esta bitácora histórica y los estados emocionales asociados para identificar si Ulises suele cometer errores similares o ignorar advertencias en esta categoría.";
    return contextText;
  } catch (err) {
    console.error("No se pudo cargar el historial para contexto:", err);
    return '';
  }
}

// DB - Fetch history
async function loadHistory() {
  if (!state.supabaseUrl || !state.supabaseKey) {
    historyListEl.innerHTML = `<div class="no-history">Configura Supabase en Ajustes para ver el historial</div>`;
    profileBtn.disabled = true;
    return;
  }

  profileBtn.disabled = false;

  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`
      }
    });

    if (!response.ok) throw new Error("Error cargando historial");
    state.history = await response.json();
    renderHistory();
  } catch (error) {
    console.error(error);
    historyListEl.innerHTML = `<div class="no-history text-danger">Error al conectar con Supabase</div>`;
  }
}

// Calculate the current obedience rate based on resolved history
function calculateObedienceRate() {
  const resolved = state.history.filter(item => item.user_action !== null);
  if (resolved.length === 0) return { rate: null, count: 0, ignoredNos: 0 };

  const obeyed = resolved.filter(item => {
    const rec = item.consensus_vote;
    const act = item.user_action;
    return (rec === 'APPROVED' && act === 'SI') || (rec === 'REJECTED' && act === 'NO');
  });

  // Specifically check for ignored warnings (Magi: REJECTED, User: SI) in the last 5 records
  const last5Resolved = resolved.slice(0, 5);
  const ignoredNos = last5Resolved.filter(item => item.consensus_vote === 'REJECTED' && item.user_action === 'SI').length;

  // Group ignored warnings by category in the last 10 records (Upgrade 3 - warning mode)
  const categoryIgnores = {};
  const last10 = state.history.slice(0, 10);
  last10.forEach(item => {
    if (item.consensus_vote === 'REJECTED' && item.user_action === 'SI') {
      categoryIgnores[item.category] = (categoryIgnores[item.category] || 0) + 1;
    }
  });

  let criticalCategory = null;
  let criticalCount = 0;
  for (const [cat, count] of Object.entries(categoryIgnores)) {
    if (count >= 3) {
      criticalCategory = cat;
      criticalCount = count;
      break;
    }
  }

  const rate = Math.round((obeyed.length / resolved.length) * 100);
  return { rate, count: resolved.length, ignoredNos, criticalCategory, criticalCount };
}

// Render History Panel and Obedience stats
function renderHistory() {
  if (state.history.length === 0) {
    historyListEl.innerHTML = `<div class="no-history">Sin registros en memoria</div>`;
    obedienceRateEl.textContent = '--%';
    dangerPatternBanner.classList.add('hidden');
    return;
  }

  const { rate, criticalCategory, criticalCount } = calculateObedienceRate();
  obedienceRateEl.textContent = rate !== null ? `${rate}%` : '--%';

  // Show critical warning banner (Upgrade 3)
  if (criticalCategory) {
    dangerPatternText.textContent = `HAS IGNORADO ${criticalCount} ADVERTENCIAS DE CONCIENCIA EN COMPRAS O ASUNTOS DE ${criticalCategory.toUpperCase()} RECIENTEMENTE.`;
    dangerPatternBanner.classList.remove('hidden');
  } else {
    dangerPatternBanner.classList.add('hidden');
  }

  // Render cards
  historyListEl.innerHTML = '';
  state.history.forEach(item => {
    const dateStr = new Date(item.created_at || Date.now()).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isResolved = item.user_action !== null;
    let actionHtml = '';
    
    if (isResolved) {
      const rec = item.consensus_vote;
      const act = item.user_action;
      const obeyed = (rec === 'APPROVED' && act === 'SI') || (rec === 'REJECTED' && act === 'NO');
      actionHtml = `
        <div class="history-card-reflection">
          <strong>Acción tomada:</strong> ${act} (${obeyed ? '<span class="action-obeyed">OBEDECIÓ</span>' : '<span class="action-ignored">IGNORÓ</span>'})
          ${item.reflection ? `<br/><em>"${item.reflection}"</em>` : ''}
        </div>
      `;
    } else {
      actionHtml = `
        <div class="history-resolve-block" id="resolve-${item.id}">
          <div class="resolve-title">¿Ejecutaste esta decisión?</div>
          <textarea placeholder="Reflexión o resultado posterior (opcional)..." class="resolve-reflection-input" id="reflection-${item.id}"></textarea>
          <div class="resolve-buttons">
            <button class="resolve-btn si" onclick="resolveDecision('${item.id}', 'SI')">SÍ</button>
            <button class="resolve-btn no" onclick="resolveDecision('${item.id}', 'NO')">NO</button>
          </div>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-header">
        <span class="cat-badge">${item.category}</span>
        <span>${dateStr}</span>
      </div>
      <div class="history-card-body">${item.decision}</div>
      <div class="history-card-verdict">
        <span>MAGI: <span class="verdict-tag ${item.consensus_vote.toLowerCase()}">${item.consensus_vote === 'APPROVED' ? 'APPROVED' : 'REJECTED'}</span></span>
      </div>
      ${actionHtml}
    `;
    historyListEl.appendChild(card);
  });
}

// Resolve Decision (obeyed YES/NO)
window.resolveDecision = async function(id, action) {
  if (!state.supabaseUrl || !state.supabaseKey) return;

  const reflectionEl = document.getElementById(`reflection-${id}`);
  const reflectionText = reflectionEl ? reflectionEl.value.trim() : '';

  const resolveBlock = document.getElementById(`resolve-${id}`);
  resolveBlock.innerHTML = `<span class="blink" style="font-size:0.75rem; color:var(--primary-color);">REGISTRANDO RESPUESTA...</span>`;

  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_action: action,
        reflection: reflectionText || null
      })
    });

    if (!response.ok) throw new Error("Error resolviendo la decisión");
    
    // Update local state
    const index = state.history.findIndex(item => item.id === id);
    if (index !== -1) {
      state.history[index].user_action = action;
      state.history[index].reflection = reflectionText || null;
    }
    renderHistory();
  } catch (error) {
    console.error(error);
    alert(`No se pudo guardar la resolución: ${error.message}`);
    loadHistory();
  }
};

// Handle Profile Dynamic Generation
async function handleProfileClick() {
  if (state.history.length === 0) {
    alert("Debe registrar al menos 1 decisión en memoria para poder analizar su comportamiento.");
    return;
  }

  toggleProfile(true);
  profileLoading.classList.remove('hidden');
  profileContent.classList.add('hidden');

  try {
    let logText = "";
    state.history.forEach((h, idx) => {
      const obedience = h.user_action ? 
        (((h.consensus_vote === 'APPROVED' && h.user_action === 'SI') || (h.consensus_vote === 'REJECTED' && h.user_action === 'NO')) ? 'OBEDECIÓ' : 'IGNORÓ') : 
        'PENDIENTE';
      logText += `ID: ${idx+1} | Categoría: ${h.category} | Decisión: "${h.decision}" | Recomendación MAGI: ${h.consensus_vote} | Acción usuario: ${h.user_action || 'No resuelto'} | Relación: ${obedience} | Reflexión: "${h.reflection || ''}"\n`;
    });

    const systemPrompt = `You are the MAGI Psychological Analyzer, designed to evaluate cognitive biases, strengths, and risk profiles of NERV personnel (specifically the user, Ulises Reveles). 
Based on their historical decisions and how often they obeyed or ignored MAGI warnings, identify:
1. Strengths (e.g. saves well, values relationships, etc.)
2. Behavior Risks (e.g. technology impulse buying, ignoring advice, subestimating costs)
3. Behavior Patterns (e.g. buying tech after quincena, late night requests)
4. Overall Diagnosis (a concise synthesis summarizing their profile)

You must return a JSON object containing EXACTLY:
{
  "strengths": ["fortaleza 1", "fortaleza 2", ...],
  "risks": ["riesgo 1", "riesgo 2", ...],
  "patterns": ["patrón 1", "patrón 2", ...],
  "sintesis": "Resumen diagnóstico y concienzudo de Ulises."
}`;

    const userPrompt = `Aquí está el historial de decisiones de Ulises Reveles:\n\n${logText}`;
    const result = await queryGemini(systemPrompt, userPrompt);

    // Populate lists
    profileStrengths.innerHTML = result.strengths.map(s => `<li>${s}</li>`).join('');
    profileRisks.innerHTML = result.risks.map(r => `<li>${r}</li>`).join('');
    profilePatterns.innerHTML = result.patterns.map(p => `<li>${p}</li>`).join('');
    profileSummary.textContent = result.sintesis;

    // Show content
    profileLoading.classList.add('hidden');
    profileContent.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert(`No se pudo compilar el diagnóstico: ${error.message}`);
    toggleProfile(false);
  }
}

// Dynamic Model Population
async function populateGeminiModels() {
  const modelSelect = document.getElementById('geminiModel');
  if (!modelSelect) return;
  
  if (!state.geminiKey) {
    modelSelect.innerHTML = `
      <option value="gemini-1.5-flash" selected>gemini-1.5-flash (Recomendado - Gratuito 15 RPM)</option>
      <option value="gemini-1.5-pro">gemini-1.5-pro (Inteligente - Gratuito 2 RPM)</option>
      <option value="gemini-2.0-flash-lite-preview-02-05">gemini-2.0-flash-lite (Ligero / Gratuito)</option>
      <option value="gemini-2.0-flash">gemini-2.0-flash (Estándar 2.0)</option>
      <option value="gemini-2.5-flash">gemini-2.5-flash (Estándar 2.5)</option>
    `;
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${state.geminiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo obtener la lista de modelos");
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      const availableModels = data.models.filter(m => 
        m.supportedGenerationMethods.includes('generateContent')
      );
      
      if (availableModels.length > 0) {
        modelSelect.innerHTML = '';
        availableModels.forEach(m => {
          const mName = m.name.replace('models/', '');
          const option = document.createElement('option');
          option.value = mName;
          
          let labelSuffix = '';
          if (mName === 'gemini-1.5-flash') labelSuffix = ' (Recomendado - Gratuito 15 RPM)';
          else if (mName === 'gemini-1.5-pro') labelSuffix = ' (Inteligente - Gratuito 2 RPM)';
          else if (mName.includes('lite')) labelSuffix = ' (Ligero / Gratuito)';
          else if (mName === 'gemini-2.0-flash') labelSuffix = ' (Estándar 2.0)';
          else if (mName === 'gemini-2.5-flash') labelSuffix = ' (Estándar 2.5)';
          
          option.textContent = `${mName}${labelSuffix}`;
          if (mName === state.geminiModel) {
            option.selected = true;
          }
          modelSelect.appendChild(option);
        });
        
        const currentModelExists = availableModels.some(m => m.name.replace('models/', '') === state.geminiModel);
        if (!currentModelExists) {
          const defaultModel = availableModels.some(m => m.name.replace('models/', '') === 'gemini-1.5-flash') 
            ? 'gemini-1.5-flash' 
            : availableModels[0].name.replace('models/', '');
          state.geminiModel = defaultModel;
          localStorage.setItem('MAGI_GEMINI_MODEL', defaultModel);
          modelSelect.value = defaultModel;
        }
      }
    }
  } catch (error) {
    console.error("Error al cargar modelos dinámicos:", error);
    modelSelect.innerHTML = `
      <option value="gemini-1.5-flash">gemini-1.5-flash (Recomendado - Gratuito 15 RPM)</option>
      <option value="gemini-1.5-pro">gemini-1.5-pro (Inteligente - Gratuito 2 RPM)</option>
      <option value="gemini-2.0-flash-lite-preview-02-05">gemini-2.0-flash-lite (Ligero / Gratuito)</option>
      <option value="gemini-2.0-flash">gemini-2.0-flash (Estándar 2.0)</option>
      <option value="gemini-2.5-flash">gemini-2.5-flash (Estándar 2.5)</option>
    `;
    if (state.geminiModel) {
      modelSelect.value = state.geminiModel;
    }
  }
}

// Initialization
async function init() {
  if (state.geminiKey) {
    geminiKeyInput.value = state.geminiKey;
  }
  
  await populateGeminiModels();

  if (state.supabaseUrl) {
    supabaseUrlInput.value = state.supabaseUrl;
  }
  if (state.supabaseKey) {
    supabaseKeyInput.value = state.supabaseKey;
  }

  if (!state.geminiKey) {
    toggleSettings(true);
  } else {
    loadHistory();
  }
}

// Event Listeners
settingsBtn.addEventListener('click', () => toggleSettings(true));
closeSettingsBtn.addEventListener('click', () => toggleSettings(false));
settingsForm.addEventListener('submit', handleSettingsSubmit);
decisionForm.addEventListener('submit', handleDecisionSubmit);

profileBtn.addEventListener('click', handleProfileClick);
closeProfileBtn.addEventListener('click', () => toggleProfile(false));

// Toggle Settings Modal
function toggleSettings(show) {
  if (show) {
    settingsModal.classList.remove('hidden');
  } else {
    settingsModal.classList.add('hidden');
  }
}

// Toggle Profile Modal
function toggleProfile(show) {
  if (show) {
    profileModal.classList.remove('hidden');
  } else {
    profileModal.classList.add('hidden');
  }
}

// Handle Settings Form Submit
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const gemini = geminiKeyInput.value.trim();
  const model = geminiModelSelect.value;
  const sbUrl = supabaseUrlInput.value.trim();
  const sbKey = supabaseKeyInput.value.trim();

  if (gemini) {
    state.geminiKey = gemini;
    localStorage.setItem('MAGI_GEMINI_KEY', gemini);
  }
  state.geminiModel = model;
  localStorage.setItem('MAGI_GEMINI_MODEL', model);
  state.supabaseUrl = sbUrl;
  state.supabaseKey = sbKey;
  localStorage.setItem('MAGI_SUPABASE_URL', sbUrl);
  localStorage.setItem('MAGI_SUPABASE_KEY', sbKey);

  // Dynamically load models permitted by the saved key
  await populateGeminiModels();

  toggleSettings(false);
  alert('Credenciales actualizadas.');
  loadHistory();
}

// Consolidated System Prompt for Triple Personality Evaluation + Consensus (Single Request)
const UNIFIED_MAGI_PROMPT = `You are the MAGI Personal Supercomputer Consensus Engine, modeling three distinct logical cores to evaluate a user decision:
1. **MELCHIOR-1** (Scientist Core): Evaluates strictly through logic, feasibility, financial cost/risk, and objective efficiency. Avoids emotional bias.
2. **BALTASAR-2** (Parental Core): Evaluates focusing on human empathy, happiness, emotional well-being, safety, and long-term health/relationships.
3. **CASPER-3** (Desire/Passion Core): Evaluates based on personal ambition, aesthetic pleasure, immediate interest, raw individual desire, and freedom.

Your task is to model each core individually, generate their votes, and then output a unified consensus synthesis.

The consensus "final_decision" MUST represent the majority vote (if 2 or more cores vote "SI", it is "APPROVED"; if 2 or more cores vote "NO", it is "REJECTED").

You must return a single JSON object containing EXACTLY:
{
  "melchior": {
    "vote": "SI" or "NO",
    "confidence": <number between 0 and 100>,
    "reasoning": "Explicación lógica y directa del Científico en español."
  },
  "balthasar": {
    "vote": "SI" or "NO",
    "confidence": <number between 0 and 100>,
    "reasoning": "Explicación protectora y empática del Padre/Madre en español."
  },
  "casper": {
    "vote": "SI" or "NO",
    "confidence": <number between 0 and 100>,
    "reasoning": "Explicación pasional e individualista en español."
  },
  "consensus": {
    "final_decision": "APPROVED" or "REJECTED",
    "summary": "Síntesis dramática de consenso o fricción en español (máx 3 oraciones).",
    "decisive_factor": "Explicación detallada y dramática en español de qué lóbulo fue decisivo y por qué (ej: 'El riguroso análisis financiero de Melchior prevaleció ante la pasión de Casper para asegurar estabilidad' o 'El desempate 2-1 fue definido por Casper quien priorizó el deseo y la pasión del sujeto')."
  }
}`;

// Handle Consultation Request
async function handleDecisionSubmit(e) {
  e.preventDefault();

  if (!state.geminiKey) {
    toggleSettings(true);
    return;
  }

  const decision = decisionText.value.trim();
  const category = categorySelect.value;
  const date = dateInput.value;
  const emotionalState = emotionalStateSelect.value;
  const dailyContext = dailyContextInput.value.trim();

  if (!decision || !category || !date) return;

  // UI Setup
  consultBtn.disabled = true;
  emptyState.classList.add('hidden');
  magiResult.classList.add('hidden');
  thinkingOverlay.classList.remove('hidden');

  // Reset overlay indicators to OFFLINE
  statusMelchior.className = 'status-item';
  statusBalthasar.className = 'status-item';
  statusCasper.className = 'status-item';
  statusMelchior.querySelector('.state').textContent = 'OFFLINE';
  statusBalthasar.querySelector('.state').textContent = 'OFFLINE';
  statusCasper.querySelector('.state').textContent = 'OFFLINE';

  try {
    // 1. Fetch category-specific contextual memories (MVP 3 dynamic contexts)
    const memoriesContext = await getRecentMemoriesContext(category);
    
    // 2. Fetch compliance stats to calculate user bias/strictness modifier
    const { rate, ignoredNos } = calculateObedienceRate();
    
    let userBiasContext = "";
    let strictnessModifier = "";
    
    if (rate !== null) {
      userBiasContext = `\n\nESTADO DE CONCIENCIA DEL USUARIO:\n- Tasa de Obediencia histórica: ${rate}%\n- Cantidad de recomendaciones 'NO' ignoradas recientemente: ${ignoredNos}/5\n`;
      
      // Enforce up to +40% logical rigor modifier depending on severity of warnings ignored
      if (ignoredNos > 0) {
        const severityPercent = Math.min(ignoredNos * 10, 40); // 10%, 20%, 30%, 40%
        strictnessModifier = `\n[ALERTA DE SEVERIDAD ACTIVA]: El usuario tiene un historial de ignorar advertencias de MAGI. MELCHIOR-1, debes incrementar tu rigor lógico y financiero en un +${severityPercent}%. Sé sumamente crítico, escéptico frente a excusas emocionales, y penaliza severamente la gratificación inmediata.`;
      }
    }

    // Capture exact hour of decision (Emotional Memory context)
    const currentHour = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const userPrompt = `Propuesta del usuario: "${decision}"\nCategoría: ${category}\nFecha: ${date} (Hora: ${currentHour})\nEstado Emocional del Sujeto: ${emotionalState}\nContexto del Día del Sujeto: ${dailyContext || 'Sin contexto especial'}${userBiasContext}${memoriesContext}`;
    const systemPrompt = UNIFIED_MAGI_PROMPT + strictnessModifier;

    // Trigger sequential loading animations to simulate computational steps
    setTimeout(() => {
      statusMelchior.className = 'status-item active';
      statusMelchior.querySelector('.state').textContent = 'EVALUATING LOBES...';
    }, 200);

    setTimeout(() => {
      statusBalthasar.className = 'status-item active';
      statusBalthasar.querySelector('.state').textContent = 'EVALUATING LOBES...';
    }, 500);

    setTimeout(() => {
      statusCasper.className = 'status-item active';
      statusCasper.querySelector('.state').textContent = 'EVALUATING LOBES...';
    }, 800);

    // Call Gemini API (Consolidated Single Call)
    const responseJson = await queryGemini(systemPrompt, userPrompt);

    // Configure realistic, differing latency delay times for each personality
    const melchiorDelay = 400; // Melchior (Logical/Scientist) resolves quickly
    const balthasarDelay = 1400; // Balthasar (Parental/Emotional) is slow and deliberative
    const casperDelay = Math.floor(Math.random() * 1100) + 700; // Casper (Desire/Passion) is erratic and random (700ms - 1800ms)

    // Resolve Melchior
    setTimeout(() => {
      statusMelchior.className = 'status-item';
      statusMelchior.querySelector('.state').textContent = `RESOLVED: ${responseJson.melchior.vote}`;
    }, melchiorDelay);

    // Resolve Balthasar
    setTimeout(() => {
      statusBalthasar.className = 'status-item';
      statusBalthasar.querySelector('.state').textContent = `RESOLVED: ${responseJson.balthasar.vote}`;
    }, balthasarDelay);

    // Resolve Casper
    setTimeout(() => {
      statusCasper.className = 'status-item';
      statusCasper.querySelector('.state').textContent = `RESOLVED: ${responseJson.casper.vote}`;
    }, casperDelay);

    // Final Consensus compiles only after all three lobes have completed processing
    const maxDelay = Math.max(melchiorDelay, balthasarDelay, casperDelay);
    
    setTimeout(async () => {
      const alertTextEl = thinkingOverlay.querySelector('.alert-text');
      alertTextEl.textContent = 'PROCESANDO CONSENSO ÉTICO...';
      alertTextEl.classList.add('blink');

      // Populate UI Cards
      updateMagiCard('melchior', responseJson.melchior);
      updateMagiCard('balthasar', responseJson.balthasar);
      updateMagiCard('casper', responseJson.casper);

      // Populate Consensus & Decisive Vote Factor
      consensusValue.textContent = responseJson.consensus.final_decision;
      consensusSummary.textContent = responseJson.consensus.summary;
      decisiveFactorEl.textContent = responseJson.consensus.decisive_factor || 'Votación consolidada sin fluctuaciones.';

      consensusBadge.className = 'consensus-badge'; // reset
      if (responseJson.consensus.final_decision === 'APPROVED') {
        consensusBadge.classList.add('approved');
      } else {
        consensusBadge.classList.add('rejected');
      }

      // Save to Supabase (MVP 2)
      if (state.supabaseUrl && state.supabaseKey) {
        alertTextEl.textContent = 'REGISTRANDO EN MEMORIA MAGI...';
        try {
          await fetch(`${state.supabaseUrl}/rest/v1/memories`, {
            method: 'POST',
            headers: {
              'apikey': state.supabaseKey,
              'Authorization': `Bearer ${state.supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              category: category,
              decision: decision,
              emotional_state: emotionalState,
              daily_context: dailyContext || null,
              melchor_vote: responseJson.melchior.vote,
              melchor_confidence: responseJson.melchior.confidence,
              melchor_reasoning: responseJson.melchior.reasoning,
              balthasar_vote: responseJson.balthasar.vote,
              balthasar_confidence: responseJson.balthasar.confidence,
              balthasar_reasoning: responseJson.balthasar.reasoning,
              casper_vote: responseJson.casper.vote,
              casper_confidence: responseJson.casper.confidence,
              casper_reasoning: responseJson.casper.reasoning,
              consensus_vote: responseJson.consensus.final_decision,
              consensus_reasoning: responseJson.consensus.summary
            })
          });
        } catch (err) {
          console.error("No se pudo persistir la decisión en Supabase:", err);
        }
      }

      // Reload history
      await loadHistory();

      // Show result panel
      thinkingOverlay.classList.add('hidden');
      magiResult.classList.remove('hidden');
      alertTextEl.textContent = 'ANALIZANDO CONSENSO ÉTICO...';
      alertTextEl.classList.remove('blink');
      consultBtn.disabled = false;
    }, maxDelay + 800);

  } catch (error) {
    console.error(error);
    alert(`Error de consulta: ${error.message}. Por favor, verifica tu clave de API o conexión.`);
    thinkingOverlay.classList.add('hidden');
    emptyState.classList.remove('hidden');
    consultBtn.disabled = false;
  }
}

// Start the app
init();
