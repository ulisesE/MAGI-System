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
const statusGaspar = document.getElementById('status-gaspar');

const consensusBadge = document.getElementById('consensusBadge');
const consensusValue = document.getElementById('consensusValue');
const consensusSummary = document.getElementById('consensusSummary');

const obedienceRateEl = document.getElementById('obedienceRate');
const historyListEl = document.getElementById('historyList');

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
function handleSettingsSubmit(e) {
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

  toggleSettings(false);
  alert('Credenciales actualizadas.');
  loadHistory();
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

// Helper to query Gemini API
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

  return JSON.parse(rawText.trim());
}

// Fetch historical memories for context injection (MVP 3)
async function getRecentMemoriesContext() {
  if (!state.supabaseUrl || !state.supabaseKey) return '';
  
  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?user_action=not.is.null&order=created_at.desc&limit=3`, {
      method: 'GET',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`
      }
    });
    if (!response.ok) return '';
    const records = await response.json();
    if (records.length === 0) return '';
    
    let contextText = "\n\nMEMORIA HISTÓRICA (Decisiones pasadas de Ulises y sus consecuencias):\n";
    records.forEach((rec, idx) => {
      contextText += `${idx+1}. Decisión: "${rec.decision}" | Recomendación MAGI: ${rec.consensus_vote} | Ulises decidió: ${rec.user_action === 'SI' ? 'Hacerlo' : 'No hacerlo'} | Consecuencia/Reflexión: "${rec.reflection || 'Sin comentarios'}"\n`;
    });
    contextText += "Usa este historial para no repetir consejos inútiles y ajustar tu criterio si el usuario cometió errores en el pasado.";
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

// Render History Panel and Obedience stats
function renderHistory() {
  if (state.history.length === 0) {
    historyListEl.innerHTML = `<div class="no-history">Sin registros en memoria</div>`;
    obedienceRateEl.textContent = '--%';
    return;
  }

  // Calculate obedience
  const resolved = state.history.filter(item => item.user_action !== null);
  if (resolved.length > 0) {
    const obeyed = resolved.filter(item => {
      const rec = item.consensus_vote; // APPROVED / REJECTED
      const act = item.user_action; // SI / NO
      return (rec === 'APPROVED' && act === 'SI') || (rec === 'REJECTED' && act === 'NO');
    });
    const rate = Math.round((obeyed.length / resolved.length) * 100);
    obedienceRateEl.textContent = `${rate}%`;
  } else {
    obedienceRateEl.textContent = '--%';
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
    // Compile history data into text block
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

// Formulate system instructions for personalities
const SYSTEM_PROMPTS = {
  melchior: `You are Melchior-1, a cold, analytical scientist. Evaluate this decision purely through logical reasoning, feasibility, financial cost/risk, and objective efficiency. Avoid emotional bias. You must return a JSON object containing EXACTLY:
{
  "vote": "SI" or "NO",
  "confidence": <number between 0 and 100>,
  "reasoning": "A concise, dry, direct explanation in Spanish detailing the logical/financial factors."
}`,

  balthasar: `You are Balthasar-2, a protective parental figure (mother/father). Evaluate this decision focusing on human empathy, happiness, emotional well-being, safety, and long-term health/relationships. You must return a JSON object containing EXACTLY:
{
  "vote": "SI" or "NO",
  "confidence": <number between 0 and 100>,
  "reasoning": "A concise, warm, protective explanation in Spanish detailing the emotional/well-being factors."
}`,

  gaspar: `You are Gaspar-3, representing raw individual desires, passion, and personal identity (as a man/woman). Evaluate this decision based on what satisfies personal ambition, aesthetic pleasure, immediate interest, and individual freedom. You must return a JSON object containing EXACTLY:
{
  "vote": "SI" or "NO",
  "confidence": <number between 0 and 100>,
  "reasoning": "A concise, passionate, individualistic explanation in Spanish detailing the desire/passion factors."
}`,

  consensus: `You are the MAGI Consensus Engine. Based on the decisions, votes, and reasonings of Melchior, Balthasar, and Gaspar, synthesize their arguments and output a final recommended decision (either "APPROVED" or "REJECTED") and a concise, dramatic executive summary in Spanish. The final decision MUST be based on the majority vote of the three computers. You must return a JSON object containing EXACTLY:
{
  "final_decision": "APPROVED" or "REJECTED",
  "summary": "A short synthesis in Spanish (max 3 sentences) explaining the consensus or friction."
}`
};

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

  if (!decision || !category || !date) return;

  // UI Setup
  consultBtn.disabled = true;
  emptyState.classList.add('hidden');
  magiResult.classList.add('hidden');
  thinkingOverlay.classList.remove('hidden');

  // Reset overlay indicators
  statusMelchior.className = 'status-item';
  statusBalthasar.className = 'status-item';
  statusGaspar.className = 'status-item';
  statusMelchior.querySelector('.state').textContent = 'OFFLINE';
  statusBalthasar.querySelector('.state').textContent = 'OFFLINE';
  statusGaspar.querySelector('.state').textContent = 'OFFLINE';

  try {
    // Retrieve historical memories context (MVP 3)
    const memoriesContext = await getRecentMemoriesContext();
    const userPrompt = `Decisión propuesta: "${decision}"\nCategoría: ${category}\nFecha: ${date}`;

    // Step 1: Query the 3 personalities in parallel
    // We animate their startup state
    statusMelchior.className = 'status-item active';
    statusMelchior.querySelector('.state').textContent = 'EVALUATING...';
    
    statusBalthasar.className = 'status-item active';
    statusBalthasar.querySelector('.state').textContent = 'EVALUATING...';
    
    statusGaspar.className = 'status-item active';
    statusGaspar.querySelector('.state').textContent = 'EVALUATING...';

    // Inject history context into individual prompts
    const melchiorPrompt = SYSTEM_PROMPTS.melchior + memoriesContext;
    const balthasarPrompt = SYSTEM_PROMPTS.balthasar + memoriesContext;
    const gasparPrompt = SYSTEM_PROMPTS.gaspar + memoriesContext;

    const [melchiorResult, balthasarResult, gasparResult] = await Promise.all([
      queryGemini(melchiorPrompt, userPrompt),
      queryGemini(balthasarPrompt, userPrompt),
      queryGemini(gasparPrompt, userPrompt)
    ]);

    // Update overlay indicators to show completion
    statusMelchior.className = 'status-item';
    statusMelchior.querySelector('.state').textContent = `RESOLVED: ${melchiorResult.vote}`;
    
    statusBalthasar.className = 'status-item';
    statusBalthasar.querySelector('.state').textContent = `RESOLVED: ${balthasarResult.vote}`;
    
    statusGaspar.className = 'status-item';
    statusGaspar.querySelector('.state').textContent = `RESOLVED: ${gasparResult.vote}`;

    // Step 2: Synthesis Consensus call
    const consensusUserPrompt = `
Decisión propuesta: "${decision}"
Categoría: ${category}

Evaluaciones individuales:
1. MELCHIOR: Voto: ${melchiorResult.vote} (Confianza: ${melchiorResult.confidence}%). Razón: ${melchiorResult.reasoning}
2. BALTASAR: Voto: ${balthasarResult.vote} (Confianza: ${balthasarResult.confidence}%). Razón: ${balthasarResult.reasoning}
3. CASPER: Voto: ${gasparResult.vote} (Confianza: ${gasparResult.confidence}%). Razón: ${gasparResult.reasoning}
    `;

    // Highlight that consensus is processing
    const alertTextEl = thinkingOverlay.querySelector('.alert-text');
    alertTextEl.textContent = 'PROCESANDO CONSENSO ÉTICO...';
    alertTextEl.classList.add('blink');

    const consensusResult = await queryGemini(SYSTEM_PROMPTS.consensus, consensusUserPrompt);

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
            melchor_vote: melchiorResult.vote,
            melchor_confidence: melchiorResult.confidence,
            melchor_reasoning: melchiorResult.reasoning,
            balthasar_vote: balthasarResult.vote,
            balthasar_confidence: balthasarResult.confidence,
            balthasar_reasoning: balthasarResult.reasoning,
            gaspar_vote: gasparResult.vote,
            gaspar_confidence: gasparResult.confidence,
            gaspar_reasoning: gasparResult.reasoning,
            consensus_vote: consensusResult.final_decision,
            consensus_reasoning: consensusResult.summary
          })
        });
      } catch (err) {
        console.error("No se pudo persistir la decisión en Supabase:", err);
      }
    }

    // Update UI Cards
    updateMagiCard('melchior', melchiorResult);
    updateMagiCard('balthasar', balthasarResult);
    updateMagiCard('gaspar', gasparResult);

    // Update Consensus UI
    consensusValue.textContent = consensusResult.final_decision;
    consensusSummary.textContent = consensusResult.summary;

    consensusBadge.className = 'consensus-badge'; // reset
    if (consensusResult.final_decision === 'APPROVED') {
      consensusBadge.classList.add('approved');
    } else {
      consensusBadge.classList.add('rejected');
    }

    // Reload history to show the logged decision in list
    await loadHistory();

    // Show result panel
    thinkingOverlay.classList.add('hidden');
    magiResult.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert(`Error de consulta: ${error.message}. Por favor, verifica tu clave de API o conexión.`);
    thinkingOverlay.classList.add('hidden');
    emptyState.classList.remove('hidden');
  } finally {
    consultBtn.disabled = false;
    const alertTextEl = thinkingOverlay.querySelector('.alert-text');
    alertTextEl.textContent = 'ANALIZANDO CONSENSO ÉTICO...';
    alertTextEl.classList.remove('blink');
  }
}

// Start the app
init();
