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
    const response = await fetch(`${state.supabaseUrl}/rest/v1/memories?order=created_at.desc&limit=10`, {
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
  }).catch(err => {
    console.error("Lazy sync failed to update resolved decision in Supabase:", err);
  });
};
