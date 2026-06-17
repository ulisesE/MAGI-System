// MAGI Personal System - Analytics Module
// Manages obedience calculations and psychological profile generation.

// Calculate compliance metrics (Memoized)
window.calculateObedienceRate = function() {
  if (state.obedienceCached) return state.obedienceCached;

  const resolved = state.history.filter(item => item.user_action !== null);
  if (resolved.length === 0) {
    state.obedienceCached = { rate: null, count: 0, ignoredNos: 0 };
    return state.obedienceCached;
  }

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
  state.obedienceCached = { rate, count: resolved.length, ignoredNos, criticalCategory, criticalCount };
  return state.obedienceCached;
};

// Handle Profile Dynamic Generation with local stats and dynamic routing
window.handleProfileClick = async function() {
  if (state.history.length === 0) {
    alert("Debe registrar al menos 1 decisión en memoria para poder analizar su comportamiento.");
    return;
  }

  if (typeof toggleProfile === 'function') toggleProfile(true);
  
  const profileLoading = document.getElementById('profileLoading');
  const profileContent = document.getElementById('profileContent');
  const profileStrengths = document.getElementById('profileStrengths');
  const profileRisks = document.getElementById('profileRisks');
  const profilePatterns = document.getElementById('profilePatterns');
  const profileSummary = document.getElementById('profileSummary');

  if (profileLoading) profileLoading.classList.remove('hidden');
  if (profileContent) profileContent.classList.add('hidden');

  try {
    // 1. Local pre-aggregation of statistics
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
    
    // Routing: Query Gemini using the configured model directly
    const result = await queryGemini(systemPrompt, userPrompt);

    // Populate lists
    if (profileStrengths) profileStrengths.innerHTML = result.strengths.map(s => `<li>${s}</li>`).join('');
    if (profileRisks) profileRisks.innerHTML = result.risks.map(r => `<li>${r}</li>`).join('');
    if (profilePatterns) profilePatterns.innerHTML = result.patterns.map(p => `<li>${p}</li>`).join('');
    if (profileSummary) profileSummary.textContent = result.sintesis;

    // Show content
    if (profileLoading) profileLoading.classList.add('hidden');
    if (profileContent) profileContent.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert(`No se pudo compilar el diagnóstico: ${error.message}`);
    if (typeof toggleProfile === 'function') toggleProfile(false);
  }
};
