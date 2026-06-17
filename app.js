// MAGI Personal System Core Logic

// State management
const state = {
  geminiKey: localStorage.getItem('MAGI_GEMINI_KEY') || '',
  geminiModel: localStorage.getItem('MAGI_GEMINI_MODEL') || 'gemini-1.5-flash',
  supabaseUrl: localStorage.getItem('MAGI_SUPABASE_URL') || '',
  supabaseKey: localStorage.getItem('MAGI_SUPABASE_KEY') || '',
  econMode: localStorage.getItem('MAGI_ECON_MODE') === 'true',
  history: [],
  cache: JSON.parse(localStorage.getItem('MAGI_DECISION_CACHE') || '{}') // Persistent cache (Upgrade 5)
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
const econModeInput = document.getElementById('econMode');

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
  
  econModeInput.checked = state.econMode;

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
  const econ = econModeInput.checked;

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
  state.econMode = econ;
  localStorage.setItem('MAGI_ECON_MODE', econ ? 'true' : 'false');

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

// Helper to query Gemini API (Unified Single Call, supporting case-specific routing - Upgrade 9)
async function queryGemini(systemPrompt, userPrompt, modelOverride = null) {
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

// Fetch historical memories context, locally compiled to save 80% tokens and network requests (Upgrade 1 & 2)
async function getRecentMemoriesContext(category) {
  if (state.econMode) return ''; // Econ Mode bypasses history context completely
  if (!state.history || state.history.length === 0) return '';

  const MAX_MEMORIES = 5; // Always limit memory to 5 max (Upgrade 1)

  // 1. Filter only resolved memories from active category
  const activeCatRecords = state.history
    .filter(r => r.category === category && r.user_action !== null)
    .slice(0, MAX_MEMORIES);

  let records = [...activeCatRecords];

  // 2. Supplement up to MAX_MEMORIES with other categories if needed
  if (records.length < MAX_MEMORIES) {
    const backupRecords = state.history
      .filter(r => r.category !== category && r.user_action !== null)
      .slice(0, MAX_MEMORIES - records.length);
    records = records.concat(backupRecords);
  }

  if (records.length === 0) return '';

  // 3. Resumir estructurado JSON compactando decisiones a 80 chars (Upgrade 2)
  const compactLogs = records.map(r => ({
    category: r.category,
    decision: r.decision.slice(0, 80),
    action: r.user_action
  }));

  return `\n\nHISTORIAL_MEMORIA_JSON:${JSON.stringify(compactLogs)}`;
}

// DB - Fetch history (Enforcing limit=15 to avoid massive token loading and Supabase latency, Upgrade 8)
async function loadHistory() {
  if (!state.supabaseUrl || !state.supabaseKey) {
    historyListEl.innerHTML = `<div class="no-history">Configura Supabase en Ajustes para ver el historial</div>`;
    profileBtn.disabled = true;
    return;
  }

  profileBtn.disabled = false;

  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?order=created_at.desc&limit=15`, {
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

// Calculate compliance metrics
function calculateObedienceRate() {
  const resolved = state.history.filter(item => item.user_action !== null);
  if (resolved.length === 0) return { rate: null, count: 0, ignoredNos: 0 };

  const obeyed = resolved.filter(item => {
    const rec = item.consensus_vote;
    const act = item.user_action;
    return (rec === 'APPROVED' && act === 'SI') || (rec === 'REJECTED' && act === 'NO');
  });

  const last5Resolved = resolved.slice(0, 5);
  const ignoredNos = last5Resolved.filter(item => item.consensus_vote === 'REJECTED' && item.user_action === 'SI').length;

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
    
    // Reset persistent caches on state resolution to ensure learning modifications update
    state.cache = {};
    localStorage.removeItem('MAGI_DECISION_CACHE');

    renderHistory();
  } catch (error) {
    console.error(error);
    alert(`No se pudo guardar la resolución: ${error.message}`);
    loadHistory();
  }
};

// Handle Profile Dynamic Generation with local stats and smart pro model routing (Upgrade 4 & 9)
async function handleProfileClick() {
  if (state.history.length === 0) {
    alert("Debe registrar al menos 1 decisión en memoria para poder analizar su comportamiento.");
    return;
  }

  toggleProfile(true);
  profileLoading.classList.remove('hidden');
  profileContent.classList.add('hidden');

  try {
    // 1. Calculate an aggregated metric summary locally (Upgrade 4)
    const resolved = state.history.filter(h => h.user_action !== null);
    const approved = state.history.filter(h => h.consensus_vote === 'APPROVED').length;
    const rejected = state.history.filter(h => h.consensus_vote === 'REJECTED').length;
    const categories = {};
    state.history.forEach(h => {
      categories[h.category] = (categories[h.category] || 0) + 1;
    });

    const examples = state.history.slice(0, 3).map(h => ({
      desc: h.decision.slice(0, 60),
      cat: h.category,
      rec: h.consensus_vote,
      act: h.user_action
    }));

    const summary = {
      total: state.history.length,
      approved,
      rejected,
      categories,
      examples
    };

    const systemPrompt = `Eres MAGI Psychological Analyzer. Analiza el JSON resumido del historial del usuario y devuelve JSON:
{
  "strengths": ["string"], // máx 3, máx 60 caracteres c/u
  "risks": ["string"], // máx 3, máx 60 caracteres c/u
  "patterns": ["string"], // máx 3, máx 60 caracteres c/u
  "sintesis": "Síntesis diagnóstica (máx 150 chars)."
}`;

    const userPrompt = JSON.stringify(summary);
    
    // 2. Case Routing: Use 'gemini-1.5-pro' for profile analysis if supported, fallback safely (Upgrade 9)
    let result;
    try {
      console.log("MAGI: Intentando perfilar con gemini-1.5-pro...");
      result = await queryGemini(systemPrompt, userPrompt, 'gemini-1.5-pro');
    } catch (proErr) {
      console.warn("Fallo con gemini-1.5-pro. Reintentando con modelo actual:", proErr);
      result = await queryGemini(systemPrompt, userPrompt);
    }

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

// [Duplicate setup, event listener, modal toggle, and settings handler declarations removed - functions are declared at lines 68-146]

// Compact, Token-Optimized System Prompt (Upgrade 3 & 6)
const UNIFIED_MAGI_PROMPT = `Eres MAGI Personal Consensus Engine. Evalúa la propuesta.
Cores:
- MELCHIOR-1 (Científico): Costo, viabilidad, riesgo, lógica.
- BALTASAR-2 (Madre): Empatía, felicidad, salud, seguridad.
- CASPER-3 (Pasión): Ambición, placer estético, deseo inmediato.
Voto final aprobado ("APPROVED") si >=2 cores votan "SI", si no "REJECTED".
Reasoning de cada core en español (máx 120 caracteres).
JSON exacto:
{
  "melchior": {"vote": "SI"|"NO", "confidence": 0-100, "reasoning": "string"},
  "balthasar": {"vote": "SI"|"NO", "confidence": 0-100, "reasoning": "string"},
  "casper": {"vote": "SI"|"NO", "confidence": 0-100, "reasoning": "string"},
  "consensus": {
    "final_decision": "APPROVED"|"REJECTED",
    "summary": "Resumen (máx 120 chars)",
    "decisive_factor": "Factor clave (máx 120 chars)"
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

  // 1. Response Caching Logic (Upgrade 5 - persistent & fast)
  const cacheKey = `${decision.toLowerCase().trim()}-${category}`;
  if (state.cache[cacheKey]) {
    console.log("MAGI: Reusing cached response for decision:", decision);
    const cachedResponse = state.cache[cacheKey];
    await renderMagiOutput(cachedResponse, decision, category, true);
    return;
  }

  // UI Setup for live run
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
    // 2. Fetch contextual memories (locally filtered, skipped if Econ Mode active - Upgrade 10)
    const memoriesContext = await getRecentMemoriesContext(category);
    
    // 3. Fetch compliance stats for user strictness calculation
    const { rate, ignoredNos } = calculateObedienceRate();
    
    let userBiasContext = "";
    let strictnessModifier = "";
    
    if (rate !== null && !state.econMode) {
      userBiasContext = `\n\nBIAS: Obediencia: ${rate}%, Ignorados: ${ignoredNos}/5\n`;
      
      // Enforce Melchior binary flag based on compliance (Upgrade 7)
      if (ignoredNos > 0) {
        strictnessModifier = `\n[STRICT_MELCHIOR:true]`; // Binary modifier instead of long parameters (Upgrade 7)
      }
    }

    // Construct minified inputs. Under Econ Mode: omit context, emotional state, and daily events (Upgrade 10)
    const userPrompt = state.econMode
      ? `dec: "${decision}"\ncat: "${category}"`
      : `dec: "${decision}"\ncat: "${category}"\nhr: "${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}"\nemo: "${emotionalState}"\nctx: "${dailyContext || 'N/A'}"${userBiasContext}${memoriesContext}`;
    
    let systemPrompt = UNIFIED_MAGI_PROMPT + strictnessModifier;
    if (state.econMode) {
      // Inject strict truncation command in Econ Mode (Upgrade 10)
      systemPrompt += `\n[ECON_MODE:ACTIVE] Limit ALL text reasoning/summaries to 60 characters max.`;
    }

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

    // Save to Cache (and persist in localStorage - Upgrade 5)
    state.cache[cacheKey] = responseJson;
    localStorage.setItem('MAGI_DECISION_CACHE', JSON.stringify(state.cache));

    // Render results
    await renderMagiOutput(responseJson, decision, category, false);

  } catch (error) {
    console.error(error);
    alert(`Error de consulta: ${error.message}. Por favor, verifica tu clave de API o conexión.`);
    thinkingOverlay.classList.add('hidden');
    emptyState.classList.remove('hidden');
    consultBtn.disabled = false;
  }
}

// Unified output renderer handling delays and data logging
async function renderMagiOutput(responseJson, decision, category, isFromCache) {
  // Configure timing. Shorter delays on cached runs
  const melchiorDelay = isFromCache ? 100 : 400;
  const balthasarDelay = isFromCache ? 250 : 1400;
  const casperDelay = isFromCache ? 150 : (Math.floor(Math.random() * 1100) + 700);

  if (isFromCache) {
    consultBtn.disabled = true;
    emptyState.classList.add('hidden');
    magiResult.classList.add('hidden');
    thinkingOverlay.classList.remove('hidden');
    
    statusMelchior.className = 'status-item active';
    statusMelchior.querySelector('.state').textContent = 'EVALUATING LOBES...';
    statusBalthasar.className = 'status-item active';
    statusBalthasar.querySelector('.state').textContent = 'EVALUATING LOBES...';
    statusCasper.className = 'status-item active';
    statusCasper.querySelector('.state').textContent = 'EVALUATING LOBES...';
  }

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
      consensusBadge.className = 'consensus-badge rejected';
    }

    // Save to Supabase (only if Econ Mode is NOT active, Upgrade 10)
    if (!state.econMode && state.supabaseUrl && state.supabaseKey) {
      alertTextEl.textContent = 'REGISTRANDO EN MEMORIA MAGI...';
      try {
        const emotionalState = emotionalStateSelect.value;
        const dailyContext = dailyContextInput.value.trim();
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
  }, maxDelay + (isFromCache ? 150 : 800));
}

// Start the app
init();
