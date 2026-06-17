// MAGI Personal System - UI Controller Module
// Manages DOM elements, modals, user event bindings, rendering, and lifecycle init.

// UI Selectors
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

// Establish default date
dateInput.value = new Date().toISOString().split('T')[0];

// Toggle Modal Helpers
window.toggleSettings = function(show) {
  if (show) {
    settingsModal.classList.remove('hidden');
  } else {
    settingsModal.classList.add('hidden');
  }
};

window.toggleProfile = function(show) {
  if (show) {
    profileModal.classList.remove('hidden');
  } else {
    profileModal.classList.add('hidden');
  }
};

// UI card updating helper
function updateMagiCard(cardId, data) {
  const card = document.getElementById(`card-${cardId}`);
  const voteEl = document.getElementById(`vote-${cardId}`);
  const reasonEl = document.getElementById(`reason-${cardId}`);
  const confEl = document.getElementById(`conf-${cardId}`);
  const progressEl = document.getElementById(`progress-${cardId}`);

  card.className = 'magi-card'; 
  const isYes = data.vote.toUpperCase() === 'SI';
  card.classList.add(isYes ? 'vote-si' : 'vote-no');

  voteEl.textContent = isYes ? 'SÍ' : 'NO';
  reasonEl.textContent = data.reasoning;
  confEl.textContent = data.confidence;
  progressEl.style.width = `${data.confidence}%`;
}

// Render History Log (capped at top 10 items)
window.renderHistory = function() {
  if (state.history.length === 0) {
    historyListEl.innerHTML = `<div class="no-history">Sin registros en memoria</div>`;
    obedienceRateEl.textContent = '--%';
    dangerPatternBanner.classList.add('hidden');
    return;
  }

  const { rate, criticalCategory, criticalCount } = calculateObedienceRate();
  obedienceRateEl.textContent = rate !== null ? `${rate}%` : '--%';

  if (criticalCategory) {
    dangerPatternText.textContent = `HAS IGNORADO ${criticalCount} ADVERTENCIAS DE CONCIENCIA EN COMPRAS O ASUNTOS DE ${criticalCategory.toUpperCase()} RECIENTEMENTE.`;
    dangerPatternBanner.classList.remove('hidden');
  } else {
    dangerPatternBanner.classList.add('hidden');
  }

  historyListEl.innerHTML = '';
  const itemsToRender = state.history.slice(0, 10);
  itemsToRender.forEach(item => {
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
};

// Resolve Decision (obeyed YES/NO - local first)
window.resolveDecision = async function(id, action) {
  const reflectionEl = document.getElementById(`reflection-${id}`);
  const reflectionText = reflectionEl ? reflectionEl.value.trim() : '';

  // 1. Update local state immediately
  const index = state.history.findIndex(item => item.id === id);
  if (index !== -1) {
    state.history[index].user_action = action;
    state.history[index].reflection = reflectionText || null;
  }
  
  // Invalidate cached statistics
  state.obedienceCached = null;
  state.cache = {};
  localStorage.removeItem('MAGI_DECISION_CACHE');

  // 2. Render UI immediately (local first!)
  renderHistory();

  // 3. Lazy Sync background PATCH to Supabase
  resolveMemoryBackground(id, action, reflectionText);
};

// Handle Settings updates
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

  // Clear models catalog cache to force refresh on credential updates
  localStorage.removeItem('MAGI_MODELS_CACHE');
  await populateGeminiModels();

  toggleSettings(false);
  alert('Credenciales actualizadas.');
  loadHistory();
}

// Handle decision submits
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

  // 1. Normalized cache retrieval
  const cacheKey = normalizeCacheKey(decision, category);
  if (state.cache[cacheKey]) {
    console.log("MAGI: Reusing cached response for decision:", decision);
    const cachedResponse = state.cache[cacheKey];
    await renderMagiOutput(cachedResponse, decision, category, true);
    return;
  }

  consultBtn.disabled = true;
  emptyState.classList.add('hidden');
  magiResult.classList.add('hidden');
  thinkingOverlay.classList.remove('hidden');
  const adviceEl = document.getElementById('consensusAdvice');
  if (adviceEl) adviceEl.classList.add('hidden');

  statusMelchior.className = 'status-item';
  statusBalthasar.className = 'status-item';
  statusCasper.className = 'status-item';
  statusMelchior.querySelector('.state').textContent = 'OFFLINE';
  statusBalthasar.querySelector('.state').textContent = 'OFFLINE';
  statusCasper.querySelector('.state').textContent = 'OFFLINE';

  try {
    const memoriesContext = await getRecentMemoriesContext(category);
    const { rate, ignoredNos } = calculateObedienceRate();
    
    let userBiasContext = "";
    let strictnessModifier = "";
    
    if (rate !== null && !state.econMode) {
      userBiasContext = `\n\nBIAS: Obediencia: ${rate}%, Ignorados: ${ignoredNos}/5\n`;
      if (ignoredNos > 0) {
        strictnessModifier = `\n[STRICT_MELCHIOR:true]`;
      }
    }

    // Minified inputs based on Econ Mode
    const userPrompt = state.econMode
      ? `dec: "${decision}"\ncat: "${category}"`
      : `dec: "${decision}"\ncat: "${category}"\nhr: "${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}"\nemo: "${emotionalState}"\nctx: "${dailyContext || 'N/A'}"${userBiasContext}${memoriesContext}`;
    
    let systemPrompt = UNIFIED_MAGI_PROMPT + strictnessModifier;
    if (state.econMode) {
      systemPrompt += `\n[ECON_MODE:ACTIVE] Limit ALL text reasoning/summaries to 60 characters max.`;
    }

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

    // Consolidated single request
    const responseJson = await queryGemini(systemPrompt, userPrompt);

    // Save to Cache and persist
    state.cache[cacheKey] = responseJson;
    localStorage.setItem('MAGI_DECISION_CACHE', JSON.stringify(state.cache));

    await renderMagiOutput(responseJson, decision, category, false);

  } catch (error) {
    console.error(error);
    alert(`Error de consulta: ${error.message}. Por favor, verifica tu clave de API o conexión.`);
    thinkingOverlay.classList.add('hidden');
    emptyState.classList.remove('hidden');
    consultBtn.disabled = false;
  }
}

// Unified output renderer handling delays and local-first lazy sync
async function renderMagiOutput(responseJson, decision, category, isFromCache) {
  const melchiorDelay = isFromCache ? 100 : 400;
  const balthasarDelay = isFromCache ? 250 : 1400;
  const casperDelay = isFromCache ? 150 : (Math.floor(Math.random() * 1100) + 700);

  if (isFromCache) {
    consultBtn.disabled = true;
    emptyState.classList.add('hidden');
    magiResult.classList.add('hidden');
    thinkingOverlay.classList.remove('hidden');
    const adviceEl = document.getElementById('consensusAdvice');
    if (adviceEl) adviceEl.classList.add('hidden');
    
    statusMelchior.className = 'status-item active';
    statusMelchior.querySelector('.state').textContent = 'EVALUATING LOBES...';
    statusBalthasar.className = 'status-item active';
    statusBalthasar.querySelector('.state').textContent = 'EVALUATING LOBES...';
    statusCasper.className = 'status-item active';
    statusCasper.querySelector('.state').textContent = 'EVALUATING LOBES...';
  }

  setTimeout(() => {
    statusMelchior.className = 'status-item';
    statusMelchior.querySelector('.state').textContent = `RESOLVED: ${responseJson.melchior.vote}`;
  }, melchiorDelay);

  setTimeout(() => {
    statusBalthasar.className = 'status-item';
    statusBalthasar.querySelector('.state').textContent = `RESOLVED: ${responseJson.balthasar.vote}`;
  }, balthasarDelay);

  setTimeout(() => {
    statusCasper.className = 'status-item';
    statusCasper.querySelector('.state').textContent = `RESOLVED: ${responseJson.casper.vote}`;
  }, casperDelay);

  const maxDelay = Math.max(melchiorDelay, balthasarDelay, casperDelay);
  
  setTimeout(async () => {
    const alertTextEl = thinkingOverlay.querySelector('.alert-text');
    alertTextEl.textContent = 'PROCESANDO CONSENSO ÉTICO...';
    alertTextEl.classList.add('blink');

    updateMagiCard('melchior', responseJson.melchior);
    updateMagiCard('balthasar', responseJson.balthasar);
    updateMagiCard('casper', responseJson.casper);

    consensusValue.textContent = responseJson.consensus.final_decision;
    consensusSummary.textContent = responseJson.consensus.summary;
    decisiveFactorEl.textContent = responseJson.consensus.decisive_factor || 'Votación consolidada sin fluctuaciones.';

    const adviceEl = document.getElementById('consensusAdvice');
    if (adviceEl) {
      if (responseJson.consensus.advice) {
        adviceEl.textContent = `CONSEJO NERV: ${responseJson.consensus.advice}`;
        adviceEl.classList.remove('hidden');
      } else {
        adviceEl.classList.add('hidden');
      }
    }

    consensusBadge.className = 'consensus-badge';
    if (responseJson.consensus.final_decision === 'APPROVED') {
      consensusBadge.classList.add('approved');
    } else {
      consensusBadge.className = 'consensus-badge rejected';
    }

    // Local First: Compile decision memory locally and unshift immediately
    const recordId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const emotionalState = emotionalStateSelect.value;
    const dailyContext = dailyContextInput.value.trim();

    const localRecord = {
      id: recordId,
      created_at: new Date().toISOString(),
      category: category,
      decision: decision,
      emotional_state: state.econMode ? 'Calmado' : emotionalState,
      daily_context: state.econMode ? null : dailyContext || null,
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
      consensus_reasoning: responseJson.consensus.advice 
        ? `${responseJson.consensus.summary} | Consejo: ${responseJson.consensus.advice}` 
        : responseJson.consensus.summary,
      user_action: null,
      reflection: null
    };

    state.history.unshift(localRecord);
    state.obedienceCached = null; 
    renderHistory();

    // Background Lazy Sync POST Supabase
    saveMemoryBackground({
      id: recordId,
      category: category,
      decision: decision,
      emotional_state: localRecord.emotional_state,
      daily_context: localRecord.daily_context,
      melchor_vote: localRecord.melchor_vote,
      melchor_confidence: localRecord.melchor_confidence,
      melchor_reasoning: localRecord.melchor_reasoning,
      balthasar_vote: localRecord.balthasar_vote,
      balthasar_confidence: localRecord.balthasar_confidence,
      balthasar_reasoning: localRecord.balthasar_reasoning,
      casper_vote: localRecord.casper_vote,
      casper_confidence: localRecord.casper_confidence,
      casper_reasoning: localRecord.casper_reasoning,
      consensus_vote: localRecord.consensus_vote,
      consensus_reasoning: localRecord.consensus_reasoning
    });

    thinkingOverlay.classList.add('hidden');
    magiResult.classList.remove('hidden');
    alertTextEl.textContent = 'ANALIZANDO CONSENSO ÉTICO...';
    alertTextEl.classList.remove('blink');
    consultBtn.disabled = false;
  }, maxDelay + (isFromCache ? 150 : 800));
}

// Dynamic Model Caching (24h - Upgrade 4 / Iteration 2)
async function populateGeminiModels() {
  const modelSelect = document.getElementById('geminiModel');
  if (!modelSelect) return;

  const cacheKey = 'MAGI_MODELS_CACHE';
  const cacheTimeKey = 'MAGI_MODELS_CACHE_TIME';
  const cachedModels = localStorage.getItem(cacheKey);
  const cachedTime = localStorage.getItem(cacheTimeKey);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  function renderModelOptions(models) {
    modelSelect.innerHTML = '';
    models.forEach(m => {
      const option = document.createElement('option');
      option.value = m.mName;
      option.textContent = `${m.mName}${m.labelSuffix || ''}`;
      if (m.mName === state.geminiModel) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });
  }

  const defaults = [
    { mName: 'gemini-1.5-flash', labelSuffix: ' (Recomendado - Gratuito 15 RPM)' },
    { mName: 'gemini-1.5-pro', labelSuffix: ' (Inteligente - Gratuito 2 RPM)' },
    { mName: 'gemini-2.0-flash-lite-preview-02-05', labelSuffix: ' (Ligero / Gratuito)' },
    { mName: 'gemini-2.0-flash', labelSuffix: ' (Estándar 2.0)' },
    { mName: 'gemini-2.5-flash', labelSuffix: ' (Estándar 2.5)' }
  ];

  if (cachedModels && cachedTime && (now - parseInt(cachedTime, 10) < ONE_DAY)) {
    console.log("MAGI: Cargando lista de modelos desde caché local (24h).");
    renderModelOptions(JSON.parse(cachedModels));
    return;
  }

  if (!state.geminiKey) {
    renderModelOptions(defaults);
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${state.geminiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo obtener la lista de modelos");
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      const availableModels = data.models
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .map(m => {
          const mName = m.name.replace('models/', '');
          let labelSuffix = '';
          if (mName === 'gemini-1.5-flash') labelSuffix = ' (Recomendado - Gratuito 15 RPM)';
          else if (mName === 'gemini-1.5-pro') labelSuffix = ' (Inteligente - Gratuito 2 RPM)';
          else if (mName.includes('lite')) labelSuffix = ' (Ligero / Gratuito)';
          else if (mName === 'gemini-2.0-flash') labelSuffix = ' (Estándar 2.0)';
          else if (mName === 'gemini-2.5-flash') labelSuffix = ' (Estándar 2.5)';
          return { mName, labelSuffix };
        });

      if (availableModels.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(availableModels));
        localStorage.setItem(cacheTimeKey, now.toString());
        renderModelOptions(availableModels);
        return;
      }
    }
    renderModelOptions(defaults);
  } catch (error) {
    console.error("Error al cargar modelos dinámicos:", error);
    renderModelOptions(defaults);
  }
}

// App Initialization
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

// Event Bindings
settingsBtn.addEventListener('click', () => toggleSettings(true));
closeSettingsBtn.addEventListener('click', () => toggleSettings(false));
settingsForm.addEventListener('submit', handleSettingsSubmit);
decisionForm.addEventListener('submit', handleDecisionSubmit);

profileBtn.addEventListener('click', handleProfileClick);
closeProfileBtn.addEventListener('click', () => toggleProfile(false));

// Launch System
init();
