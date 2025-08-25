/****************************************************
 * ALEGREMENTE 2025 – Escena (GENÉRICO)
 * Compatible con cualquier escena (scene1..scene8)
 * Usa los data-* del <body> y las clases/IDs de tu HTML/CSS
 *
 * Funcionalidades:
 * - Cards plegables con accesibilidad (tecla Enter/Espacio)
 * - Reproductor de audio robusto con múltiples pistas (data-audio)
 * - Carga de Guion (PDF) + enlaces Ver/Descargar (data-guion)
 * - Enlace a carpeta de partituras (data-scores-url)
 * - Filtros por área/centro/log + búsqueda con persistencia
 * - Tarjeta dinámica de recursos (guion, fondo, partituras)
 * - Vista previa de imágenes (overlay) con cierre por click/ESC
 * - Fallbacks: HERO, PDF, audio y enlaces deshabilitados
 ****************************************************/

/* Helpers cortos */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* Contexto de escena */
const body = document.body;
const SCENE_ID = (body?.id || 'scene').toLowerCase();        // ej: "scene6"
const LS_KEY   = `alegremente_filters_${SCENE_ID}_v1`;

/* Utilidades */
function bust(url){ return `${encodeURI(url)}?v=${Date.now()}`; }
function headOk(url){ return fetch(url, { method:'HEAD' }).then(r => r.ok).catch(()=>false); }

/* =====================================================================================
   1) CARDS PLEGABLES (con accesibilidad)
===================================================================================== */
function toggle(h){
  const card = h.parentElement;
  const content = card.querySelector('.content');
  const caret = h.querySelector('.caret');
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (caret) caret.textContent = open ? 'Expandir' : 'Contraer';
  h.setAttribute('tabindex','0'); h.focus({ preventScroll:true });
}

document.addEventListener('DOMContentLoaded', () => {
  // Abiertas por defecto
  $$('.card .content').forEach(c => c.style.display = 'block');

  // Headers focusables + atajos
  $$('.card > header').forEach(h => {
    h.setAttribute('role','button');
    h.setAttribute('tabindex','0');
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(h); }
    });
  });
});

/* =====================================================================================
   2) HERO (imagen principal) – fallback elegante si falla
===================================================================================== */
(function initHero(){
  const img = $('.hero img');
  const heroAttr = (body?.dataset?.hero || '').trim(); // ej: "Escena 6.jpg"
  if (!img) return;

  // Prioriza data-hero si existe
  if (heroAttr) img.src = heroAttr;

  // Alt por accesibilidad
  img.alt = img.alt || 'Imagen principal de la escena';

  // Fallback si no carga
  img.addEventListener('error', () => {
    img.removeAttribute('src');
    img.style.background =
      'linear-gradient(135deg,#e0e7ff,#cffafe,#fde68a)';
    img.style.minHeight = '200px';
    img.style.display = 'block';
    img.setAttribute('aria-label','Portada no disponible');
    console.warn('[AlegreMente] HERO no encontrado. Verifica nombre/ruta del archivo.');
  });
})();

/* =====================================================================================
   3) AUDIO con múltiples pistas (data-audio)
===================================================================================== */
(function initAudio(){
  const audio = $('#sceneAudio');
  const btn   = $('#btnPlay');
  const label = $('#audioLabel');
  if (!audio || !btn) return;

  // Pistas declaradas en data-audio o fallback por escena
  const declared = (body?.dataset?.audio || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  // Fallback suave con el nombre del tema sugerido por tu HTML
  const FALLBACK = ['Tierra Imaginaria.mp3'];
  const tracks = declared.length ? declared : FALLBACK;

  let idx = 0;
  function setSrc(i){
    audio.src = bust(tracks[i]);
    if (label){
      const nice = tracks[i].replace(/\.(mp3|wav|m4a)$/i,'');
      label.textContent = `🎶 Audio: ${nice}`;
    }
  }
  setSrc(idx);

  function updateBtn(){ btn.textContent = audio.paused ? '▶ Reproducir' : '⏸️ Pausar'; }
  async function tryPlay(){
    try{ await audio.play(); }
    catch{
      // Autoplay bloqueado: marca sutilmente el botón
      btn.style.boxShadow = '0 0 0 3px rgba(245,158,11,.25)';
      btn.title = 'Haz clic para iniciar (autoplay bloqueado).';
    }
    updateBtn();
  }

  document.addEventListener('DOMContentLoaded', tryPlay);

  // La primera interacción desbloquea audio
  ['pointerdown','keydown','touchstart'].forEach(ev=>{
    window.addEventListener(ev, ()=> audio.play().then(updateBtn).catch(()=>{}), { once:true, capture:true });
  });

  btn.addEventListener('click', async () => {
    try{ audio.paused ? await audio.play() : audio.pause(); }catch{}
    updateBtn();
  });

  // Cambia de pista si falla la actual
  audio.addEventListener('error', () => {
    if (idx < tracks.length - 1){ idx++; setSrc(idx); tryPlay(); }
    else console.error('[AlegreMente] No se pudo cargar ninguna pista de audio.');
  });

  // Barra espaciadora: play/pause (si no estás escribiendo)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/input|textarea|select/i.test(e.target.tagName)){
      e.preventDefault();
      audio.paused ? audio.play().catch(()=>{}) : audio.pause();
      updateBtn();
    }
  });

  // Pausa si cambian de pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) audio.pause();
  });
})();

/* =====================================================================================
   4) GUION (PDF) + PARTITURAS
===================================================================================== */
(async function initDocs(){
  const pdfFrame    = $('.pdf-frame');
  const pdfView     = $('#pdfView');
  const pdfDownload = $('#pdfDownload');

  // Nombre por defecto según escena (si no viene en data-guion)
  const defaultGuion = {
    scene1:'Guión Escena I.pdf', scene2:'Guión Escena II.pdf', scene3:'Guión Escena III.pdf',
    scene4:'Guión Escena IV.pdf', scene5:'Guión Escena V.pdf', scene6:'Guión Escena VI.pdf',
    scene7:'Guión Escena VII.pdf', scene8:'Guión Escena VIII.pdf'
  }[SCENE_ID] || 'Guion.pdf';

  const guion = (body?.dataset?.guion || defaultGuion).trim();
  const encoded = encodeURI(guion);

  if (pdfView)     pdfView.href = encoded;
  if (pdfDownload) pdfDownload.href = encoded;

  if (pdfFrame){
    const ok = await headOk(encoded);
    if (ok) pdfFrame.src = `${encoded}#toolbar=1&navpanes=0&statusbar=0&view=FitH`;
    else pdfFrame.style.display = 'none';
  }

  // Partituras (carpeta)
  const scoresUrl = (body?.dataset?.scoresUrl || '').trim();
  const link = $('#allScoresLink');
  if (link){
    link.href = scoresUrl || '#';
    if (!scoresUrl){
      link.setAttribute('aria-disabled','true');
      link.classList.add('disabled');
      link.textContent = '📂 Carpeta de partituras (pendiente)';
      link.addEventListener('click', (e)=> e.preventDefault());
    }
  }
})();

/* =====================================================================================
   5) FILTROS + BÚSQUEDA + RECURSOS DINÁMICOS
===================================================================================== */
(function initFilters(){
  const chips = $$('.chip');
  const cards = $$('.card');
  const q     = $('#q');

  // Cargar estado previo (por escena)
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch{}
  if (saved){
    chips.forEach(ch => {
      const t = ch.dataset.type;
      if (t === 'area'   && saved.areas?.includes(ch.dataset.area))     ch.classList.add('active');
      if (t === 'centro' && saved.centros?.includes(ch.dataset.centro)) ch.classList.add('active');
      if (t === 'log'    && saved.logs?.includes(ch.dataset.log))       ch.classList.add('active');
    });
    if (q && typeof saved.query === 'string') q.value = saved.query;
  }

  // Recursos base desde data-*
  const RESOURCES = [
    { title: 'Guion (PDF)',               href: encodeURI(body?.dataset?.guion  || ''), areas: ['teatro','produccion'], type: 'pdf'  },
    { title: 'Carpeta de partituras',     href: (body?.dataset?.scoresUrl || '#'),      areas: ['musica'],              type: 'link' },
    { title: 'Fondo proyectado (JPG)',    href: encodeURI(body?.dataset?.fondo || ''),  areas: ['plastica','luces'],    type: 'link' }
  ];
  const ICON = { pdf:'📄', audio:'🎵', sheet:'📊', doc:'📝', link:'🔗' };

  function getState(){
    const areas = chips.filter(c => c.dataset.type==='area'   && c.classList.contains('active')).map(c => c.dataset.area);
    const centros = chips.filter(c => c.dataset.type==='centro' && c.classList.contains('active')).map(c => c.dataset.centro);
    const logs = chips.filter(c => c.dataset.type==='log'    && c.classList.contains('active')).map(c => c.dataset.log);
    return { areas, centros, logs, query: (q?.value?.trim() || '') };
  }

  function cardMatches(card, st){
    const tags = (card.dataset.tags || 'general').split(/\s+/);
    const areaOk = (st.areas.length === 0) || st.areas.some(a => tags.includes(a));

    const centrosCard = (card.dataset.centros || '').split(/\s+/).filter(Boolean);
    const centroOk = (st.centros.length === 0) || st.centros.some(c => centrosCard.includes(c));

    const logsCard = (card.dataset.log || '').split(/\s+/).filter(Boolean);
    const logOk = (st.logs.length === 0) || st.logs.some(l => logsCard.includes(l));

    const textOk = (card.textContent||'').toLowerCase().includes(st.query.toLowerCase());
    return areaOk && centroOk && logOk && textOk;
  }

  function ensureResourcesCard(){
    let ul = $('#res-list');
    if (!ul){
      const section = document.querySelector('main section');
      if (!section) return null;
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-tags','produccion general');
      card.innerHTML = `
        <header onclick="toggle(this)"><h2>🔗 Recursos de esta escena</h2><span class="caret">Contraer</span></header>
        <div class="content"><ul id="res-list"></ul></div>`;
      section.appendChild(card);
      ul = $('#res-list');
    }
    return ul;
  }

  function renderResources(st){
    const ul = ensureResourcesCard();
    if (!ul) return;

    const items = RESOURCES
      .filter(r => r.href && r.href !== '#')
      .filter(r => (!st.areas.length || r.areas.some(a => st.areas.includes(a))));

    ul.innerHTML = items.map(r =>
      `<li><a href="${r.href}" target="_blank" rel="noreferrer">${ICON[r.type]||ICON.link} ${r.title}</a>
       <small class="muted"> (${r.areas.join(', ')})</small></li>`
    ).join('') || `<li class="muted">No hay recursos para este filtro.</li>`;
  }

  function apply(){
    const st = getState();
    cards.forEach(card => { card.style.display = cardMatches(card, st) ? '' : 'none'; });
    localStorage.setItem(LS_KEY, JSON.stringify(st));
    renderResources(st);
  }

  chips.forEach(chip => chip.addEventListener('click', () => { chip.classList.toggle('active'); apply(); }));
  if (q) q.addEventListener('input', apply);

  document.addEventListener('DOMContentLoaded', apply);
})();

/* =====================================================================================
   6) VISTA PREVIA DE IMÁGENES (overlay)
===================================================================================== */
(function initImagePreview(){
  function ensureOverlay(){
    let o = $('#imgPreviewOverlay');
    if (!o){
      o = document.createElement('div');
      o.id = 'imgPreviewOverlay';
      Object.assign(o.style, {
        position:'fixed', inset:'0', display:'none', zIndex:'9999',
        background:'rgba(0,0,0,.85)', alignItems:'center', justifyContent:'center', padding:'24px'
      });
      const img = document.createElement('img');
      img.alt = 'Vista previa';
      Object.assign(img.style, {
        maxWidth:'92vw', maxHeight:'92vh', borderRadius:'14px',
        boxShadow:'0 20px 60px rgba(0,0,0,.45)'
      });
      o.appendChild(img);
      document.body.appendChild(o);

      // Cierre por clic o ESC
      o.addEventListener('click', () => o.style.display='none');
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') o.style.display='none'; });
    }
    return o;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-preview]');
    if (!a) return;
    e.preventDefault();
    const overlay = ensureOverlay();
    overlay.querySelector('img').src = a.getAttribute('href');
    overlay.style.display = 'flex';
  });
})();

/* =====================================================================================
   7) EXTRAS UX
===================================================================================== */
(function enhanceUX(){
  // Enlaces marcados como deshabilitados visibles
  $$('a[aria-disabled="true"]').forEach(a => {
    a.style.opacity = '0.6';
    a.style.cursor = 'not-allowed';
  });

  // Carga perezosa para todas las imágenes (si el HTML no la trae)
  $$('img').forEach(img => { if (!img.hasAttribute('loading')) img.setAttribute('loading','lazy'); });
})();
