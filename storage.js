// MAGI Personal System - Storage Module
// Manages local caching, context lookup, and background Supabase synchronization.

// Cache key normalizer to collapse spaces and normalise case
window.normalizeCacheKey = function(decision, category) {
  const cleanDecision = decision.toLowerCase().trim().replace(/\s+/g, ' ');
  const cleanCategory = category.toLowerCase().trim();
  return `${cleanDecision}-${cleanCategory}`;
};

// Fetch historical memories context, locally compiled in ultra-compact format to save tokens
window.getRecentMemoriesContext = async function(category) {
  if (state.econMode) return ''; 
  if (!state.history || state.history.length === 0) return '';

  const MAX_MEMORIES = 6; // Expanded context limit

  // 1. Get recent memories from active category (include pending ones)
  const activeCatRecords = state.history
    .filter(r => r.category === category)
    .slice(0, MAX_MEMORIES);

  let records = [...activeCatRecords];

  // 2. Supplement up to MAX_MEMORIES with other categories if needed
  if (records.length < MAX_MEMORIES) {
    const backupRecords = state.history
      .filter(r => r.category !== category)
      .slice(0, MAX_MEMORIES - records.length);
    records = records.concat(backupRecords);
  }

  if (records.length === 0) return '';

  // 3. Compact piped context string (no JSON brackets)
  const compactLogs = records.map(r => {
    const actionVal = r.user_action === null ? 'PENDING' : r.user_action;
    return `cat:${r.category.toLowerCase()}|dec:${r.decision.slice(0, 150).replace(/\|/g, '')}|rec:${r.consensus_vote}|act:${actionVal}`;
  }).join(' || ');

  return `\n\nMem: [${compactLogs}]`;
};

// DB - Fetch history (limit=10 to avoid token loading overheads)
window.loadHistory = async function() {
  const historyListEl = document.getElementById('historyList');
  const profileBtn = document.getElementById('profileBtn');

  if (!state.supabaseUrl || !state.supabaseKey) {
    if (historyListEl) {
      historyListEl.innerHTML = `<div class="no-history">Configura Supabase en Ajustes para ver el historial</div>`;
    }
    if (profileBtn) profileBtn.disabled = true;
    return;
  }

  if (profileBtn) profileBtn.disabled = false;

  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?order=created_at.desc&limit=30`, {
      method: 'GET',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`
      }
    });

    if (!response.ok) throw new Error("Error cargando historial");
    state.history = await response.json();
    state.obedienceCached = null; // Invalidate cached obedience stats on reload
    
    if (typeof window.renderHistory === 'function') {
      window.renderHistory();
    }

    // Try loading consolidated summary from Supabase, then trigger background refresh
    await loadProfileSummaryFromSupabase();
    window.updateProfileSummaryBackground();
  } catch (error) {
    console.error(error);
    if (historyListEl) {
      historyListEl.innerHTML = `<div class="no-history text-danger">Error al conectar con Supabase</div>`;
    }
  }
};

// Background Sync - Save new memory record to Supabase
window.saveMemoryBackground = function(record) {
  if (state.econMode || !state.supabaseUrl || !state.supabaseKey) return;
  
  fetch(`${state.supabaseUrl}/rest/v1/memories`, {
    method: 'POST',
    headers: {
      'apikey': state.supabaseKey,
      'Authorization': `Bearer ${state.supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(record)
  }).then(() => {
    // Re-summarize profile memory in background after a new memory is pushed
    window.updateProfileSummaryBackground();
  }).catch(err => {
    console.error("Lazy sync failed to save decision to Supabase:", err);
  });
};

// Background Sync - Update resolved action in Supabase
window.resolveMemoryBackground = function(id, action, reflectionText) {
  if (!state.supabaseUrl || !state.supabaseKey) return;

  fetch(`${state.supabaseUrl}/rest/v1/memories?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': state.supabaseKey,
      'Authorization': `Bearer ${state.supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_action: action,
      reflection: reflectionText || null
    })
  }).then(() => {
    // Re-summarize profile memory in background after user resolves a decision
    window.updateProfileSummaryBackground();
  }).catch(err => {
    console.error("Lazy sync failed to update resolved decision in Supabase:", err);
  });
};

// Helper: load profile summary from Supabase if table exists
async function loadProfileSummaryFromSupabase() {
  if (!state.supabaseUrl || !state.supabaseKey) return;
  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/profile_summary?id=eq.user_profile`, {
      method: 'GET',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].summary) {
        localStorage.setItem('MAGI_BEHAVIORAL_SUMMARY', data[0].summary);
      }
    }
  } catch (err) {
    console.warn("Could not load profile summary from Supabase (table may not exist):", err);
  }
}

// Helper: save profile summary to Supabase if table exists
async function syncProfileSummaryToSupabase(summary) {
  if (!state.supabaseUrl || !state.supabaseKey) return;
  try {
    const response = await fetch(`${state.supabaseUrl}/rest/v1/profile_summary`, {
      method: 'POST',
      headers: {
        'apikey': state.supabaseKey,
        'Authorization': `Bearer ${state.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 'user_profile',
        summary: summary,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      console.warn("Supabase profile_summary sync failed (table may not exist, falling back to localStorage).");
    }
  } catch (err) {
    console.warn("Error syncing profile summary to Supabase:", err);
  }
}

// Background Sync - Update psychological/financial profile summary
window.updateProfileSummaryBackground = async function() {
  if (state.econMode || !state.history || state.history.length === 0 || !state.geminiKey) return;

  try {
    // Compile recent history into compact representation (last 20 records)
    const recentRecords = state.history.slice(0, 20);
    const compactHistory = recentRecords.map(r => {
      const act = r.user_action === null ? 'PENDING' : r.user_action;
      return `[cat:${r.category}|dec:${r.decision.slice(0, 100)}|rec:${r.consensus_vote}|act:${act}]`;
    }).join('\n');

    const systemPrompt = `Eres MAGI Behavioral Summarizer. Analiza el historial de decisiones del usuario y genera un resumen compacto (máx 200 palabras) en español de su perfil conductual, hábitos de gasto (Finanzas), cumplimiento de directivas MAGI y comportamiento general. Sé preciso, destacando patrones de indisciplina o aciertos.
Responde estrictamente en formato JSON:
{"summary": "tu resumen aquí"}`;

    const userPrompt = `Historial Reciente:\n${compactHistory}`;

    const responseJson = await queryGemini(systemPrompt, userPrompt);
    const summary = responseJson.summary || '';
    if (summary) {
      localStorage.setItem('MAGI_BEHAVIORAL_SUMMARY', summary);
      await syncProfileSummaryToSupabase(summary);
      console.log("MAGI: Behavioral summary updated successfully.");
    }
  } catch (err) {
    console.warn("Failed to generate background profile summary:", err);
  }
};

// Fetch profile summary text as injected prompt context
window.getProfileSummaryContext = function() {
  if (state.econMode) return '';
  const cachedSummary = localStorage.getItem('MAGI_BEHAVIORAL_SUMMARY');
  if (!cachedSummary) return '';
  return `\n\nProfile Memory: [${cachedSummary}]`;
};
