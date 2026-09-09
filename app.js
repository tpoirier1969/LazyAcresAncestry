(() => {
  'use strict';
  const CFG = window.LAZY_ACRES_ANCESTRY_CONFIG || {};
  const STAGE = { width: 1800, height: 1080 };
  const CARD = { width: 224, height: 230 };
  const els = {
    viewport: document.getElementById('treeViewport'), stage: document.getElementById('treeStage'),
    cards: document.getElementById('cardsLayer'), connectors: document.getElementById('connectors'),
    source: document.getElementById('sourcePill'), search: document.getElementById('searchInput'),
    detail: document.getElementById('detailPanel'), detailContent: document.getElementById('detailContent'),
    detailClose: document.getElementById('detailClose'), siblingDrawer: document.getElementById('siblingDrawer'),
    siblingTrack: document.getElementById('siblingTrack'), siblingTitle: document.getElementById('siblingTitle'),
    siblingClose: document.getElementById('siblingClose'), toast: document.getElementById('toast'),
    filters: document.getElementById('branchFilters'), fit: document.getElementById('fitBtn'),
    zoomIn: document.getElementById('zoomInBtn'), zoomOut: document.getElementById('zoomOutBtn')
  };
  let state = { people: [], relationships: [], byGedcom: new Map(), branch: 'all', scale: 0.7, x: 0, y: 0, dragging: false, dragStart: null };

  const POSITIONS = {
    I40538616541: [190, 125], I40538615169: [500, 125],
    I40538615602: [1085, 125], I40538615779: [1395, 125],
    I40538616542: [345, 455], I40538615623: [1240, 455],
    I40538616551: [675, 785], I352435523781: [965, 785], I40538616398: [1275, 785]
  };
  const ACCENTS = { paternal: '#80c6b2', maternal: '#c8a7d8', center: '#e7c779' };

  function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function roleLabel(role) { return ({root:'You',spouse:'Spouse',sibling:'Sibling',parent:'Parent',grandparent:'Grandparent','grandparent-sibling':'Grandparent sibling'})[role] || role || 'Family'; }
  function avatarSvg(sex, accent='#d9b96e') {
    const female = sex === 'F';
    return `<svg viewBox="0 0 80 92" role="img" aria-label="Generic ${female?'female':'male'} portrait"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${accent}" stop-opacity=".06"/></linearGradient></defs><rect width="80" height="92" rx="16" fill="url(#g)"/><circle cx="40" cy="31" r="15" fill="rgba(241,239,226,.82)"/><path d="M14 88c2-23 11-35 26-35s24 12 26 35" fill="rgba(241,239,226,.76)"/>${female?'<path d="M26 31c0-15 8-22 14-22s15 8 15 23c-5-5-10-8-15-8-4 0-9 2-14 7Z" fill="rgba(15,28,24,.72)"/>':'<path d="M25 28c2-13 9-19 16-19 8 0 14 6 15 19-5-4-10-6-16-6s-11 2-15 6Z" fill="rgba(15,28,24,.72)"/>'}</svg>`;
  }
  function normalizeSupabasePerson(p) {
    return { gedcom_id:p.gedcom_id, name:p.display_name, given:p.given_name, surname:p.surname, sex:p.sex, role:p.sample_role, branch:p.branch, cluster:p.cluster_key,
      birth:{date:p.birth_date_text, plac:p.birth_place}, death:{date:p.death_date_text, plac:p.death_place}, is_living:p.is_living, data_quality_note:p.data_quality_note };
  }
  async function supabaseFetch(path) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/${path}`, { headers: { apikey: CFG.supabasePublishableKey, Authorization: `Bearer ${CFG.supabasePublishableKey}` } });
    if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json();
  }
  async function loadData() {
    if (CFG.supabaseUrl && CFG.supabasePublishableKey) {
      try {
        const [peopleRows, relRows] = await Promise.all([
          supabaseFetch('lazy_acres_ancestry_people?select=gedcom_id,display_name,given_name,surname,sex,birth_date_text,birth_place,death_date_text,death_place,is_living,branch,sample_role,cluster_key,data_quality_note&sample_role=not.is.null'),
          supabaseFetch('lazy_acres_ancestry_relationships?select=relationship_type,from:lazy_acres_ancestry_people!lazy_acres_ancestry_relationships_from_person_id_fkey(gedcom_id),to:lazy_acres_ancestry_people!lazy_acres_ancestry_relationships_to_person_id_fkey(gedcom_id)')
        ]);
        state.people = peopleRows.map(normalizeSupabasePerson);
        state.relationships = relRows.map(r => ({ type:r.relationship_type, from:r.from?.gedcom_id, to:r.to?.gedcom_id })).filter(r=>r.from&&r.to);
        els.source.textContent = `Live · Supabase · ${state.people.length} people`;
        els.source.title = 'Reading the Lazy Acres Ancestry tables in the shared personal Supabase project.';
        return;
      } catch (err) { console.warn('Supabase unavailable, using bundled data.', err); }
    }
    const fallback = await fetch('data/sample-family.json').then(r => { if(!r.ok) throw new Error('Sample data unavailable'); return r.json(); });
    state.people = fallback.people.map(p => ({...p, is_living:!p.death?.date, data_quality_note: ['Michael Buccos','Michael Mateo Bucco'].includes(p.name) ? 'Possible duplicate: another Michael Bucco/Buccos record has the same birth and death dates.' : null }));
    state.relationships = fallback.relationships;
    els.source.textContent = `Bundled sample · ${state.people.length} people`;
  }
  function buildIndex(){ state.byGedcom = new Map(state.people.map(p=>[p.gedcom_id,p])); }
  function mainPeople(){ return state.people.filter(p=>POSITIONS[p.gedcom_id]); }
  function siblingCount(cluster){ return state.people.filter(p=>p.cluster===cluster && p.role==='grandparent-sibling').length; }
  function cardHtml(p){
    const accent=ACCENTS[p.branch]||ACCENTS.center; const sibs=p.role==='grandparent'?siblingCount(p.cluster):0;
    return `<article class="person-card ${escapeHtml(p.role||'')}" data-id="${escapeHtml(p.gedcom_id)}" data-branch="${escapeHtml(p.branch||'center')}" style="--accent:${accent}">
      ${p.data_quality_note?'<span class="data-flag" title="Data quality note">!</span>':''}
      <div class="card-head"><div class="avatar">${avatarSvg(p.sex,accent)}</div><div class="person-meta"><h2 class="person-name">${escapeHtml(p.name)}</h2><div class="person-role">${escapeHtml(roleLabel(p.role))}</div></div></div>
      <div class="life"><div class="life-line"><strong>B</strong><span>${escapeHtml(p.birth?.date||'Unknown')}<br>${escapeHtml(p.birth?.plac||'')}</span></div>${p.death?.date?`<div class="life-line"><strong>D</strong><span>${escapeHtml(p.death.date)}<br>${escapeHtml(p.death.plac||'')}</span></div>`:''}</div>
      ${sibs?`<button class="sibling-button" data-cluster="${escapeHtml(p.cluster)}">View ${sibs} sibling${sibs===1?'':'s'}</button>`:''}
    </article>`;
  }
  function renderCards(){
    els.cards.innerHTML=mainPeople().map(cardHtml).join('');
    els.cards.querySelectorAll('.person-card').forEach(card=>{
      const [x,y]=POSITIONS[card.dataset.id]; card.style.left=`${x}px`; card.style.top=`${y}px`;
      card.addEventListener('click',e=>{ if(e.target.closest('.sibling-button')) return; showDetails(card.dataset.id); });
    });
    els.cards.querySelectorAll('.sibling-button').forEach(btn=>btn.addEventListener('click',e=>{ e.stopPropagation(); openSiblingDrawer(btn.dataset.cluster); }));
  }
  function centerOf(id, where='center'){ const pos=POSITIONS[id]; if(!pos)return null; const [x,y]=pos; return {x:x+CARD.width/2,y:y+(where==='top'?0:where==='bottom'?CARD.height:CARD.height/2)}; }
  function curve(a,b){ const mid=(a.y+b.y)/2; return `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`; }
  function renderConnectors(){
    const bits=[];
    state.relationships.forEach(r=>{
      if(!POSITIONS[r.from]||!POSITIONS[r.to]) return;
      const fp=state.byGedcom.get(r.from), tp=state.byGedcom.get(r.to);
      if(r.type==='parent'){
        const a=centerOf(r.from,'bottom'),b=centerOf(r.to,'top'); const cls=(fp?.branch==='maternal'||tp?.branch==='maternal')?'maternal':'paternal'; bits.push(`<path class="connector ${cls}" d="${curve(a,b)}"/>`);
      } else if(r.type==='spouse'){
        const a=centerOf(r.from),b=centerOf(r.to); bits.push(`<path class="connector spouse" d="M ${a.x} ${a.y} L ${b.x} ${b.y}"/>`);
      }
    });
    els.connectors.innerHTML=bits.join('');
  }
  function showDetails(id){
    const p=state.byGedcom.get(id); if(!p)return; const accent=ACCENTS[p.branch]||ACCENTS.center;
    els.detailContent.innerHTML=`<div class="detail-hero"><div class="avatar">${avatarSvg(p.sex,accent)}</div><div><h2>${escapeHtml(p.name)}</h2><div class="detail-kicker">${escapeHtml(roleLabel(p.role))} · ${escapeHtml(p.branch||'family')}</div></div></div>
      <div class="fact-grid"><div class="fact"><div class="fact-label">Born</div><div class="fact-value">${escapeHtml(p.birth?.date||'Unknown')}<br>${escapeHtml(p.birth?.plac||'Place unknown')}</div></div>
      <div class="fact"><div class="fact-label">Died</div><div class="fact-value">${p.death?.date?`${escapeHtml(p.death.date)}<br>${escapeHtml(p.death.plac||'Place unknown')}`:'Living / no death recorded in GEDCOM'}</div></div>
      <div class="fact"><div class="fact-label">GEDCOM record</div><div class="fact-value">${escapeHtml(p.gedcom_id)}</div></div></div>
      ${p.data_quality_note?`<div class="quality-note"><strong>Data note:</strong> ${escapeHtml(p.data_quality_note)}</div>`:''}
      <div class="future-panel"><h3>Photos & family notes</h3><p>This prototype is ready for media and comments. When the R2 archive is connected, confirmed family photographs will appear here with matching evidence and discussion.</p></div>`;
    els.detail.classList.add('open'); els.detail.setAttribute('aria-hidden','false');
  }
  function closeDetails(){ els.detail.classList.remove('open'); els.detail.setAttribute('aria-hidden','true'); }
  function openSiblingDrawer(cluster){
    const main=state.people.find(p=>p.cluster===cluster&&p.role==='grandparent'); const sibs=state.people.filter(p=>p.cluster===cluster&&p.role==='grandparent-sibling');
    els.siblingTitle.textContent=`${main?.surname||main?.name||'Family'} siblings`;
    els.siblingTrack.innerHTML=sibs.map(p=>{const a=ACCENTS[p.branch]||ACCENTS.center;return `<article class="sibling-mini" data-id="${escapeHtml(p.gedcom_id)}"><div class="avatar">${avatarSvg(p.sex,a)}</div><h3>${escapeHtml(p.name)}</h3><p><strong>Born:</strong> ${escapeHtml(p.birth?.date||'Unknown')}</p><p>${escapeHtml(p.birth?.plac||'')}</p>${p.death?.date?`<p><strong>Died:</strong> ${escapeHtml(p.death.date)}</p>`:''}${p.data_quality_note?'<p style="color:#e8a27f">⚑ possible duplicate record</p>':''}</article>`}).join('');
    els.siblingTrack.querySelectorAll('.sibling-mini').forEach(c=>c.addEventListener('click',()=>showDetails(c.dataset.id)));
    els.siblingDrawer.classList.add('open'); els.siblingDrawer.setAttribute('aria-hidden','false');
  }
  function closeSiblingDrawer(){ els.siblingDrawer.classList.remove('open'); els.siblingDrawer.setAttribute('aria-hidden','true'); }
  function applyBranchFilter(){
    document.querySelectorAll('.person-card').forEach(c=>{const p=state.byGedcom.get(c.dataset.id); const keep=state.branch==='all'||p.branch===state.branch||p.branch==='center'||p.role==='root'||p.role==='spouse'||p.role==='sibling'; c.classList.toggle('dimmed',!keep);});
  }
  function doSearch(){
    const q=els.search.value.trim().toLowerCase(); document.querySelectorAll('.person-card').forEach(c=>c.classList.remove('search-hit'));
    if(!q)return; const matches=state.people.filter(p=>p.name.toLowerCase().includes(q)); const main=matches.find(p=>POSITIONS[p.gedcom_id]);
    if(main){ const card=document.querySelector(`.person-card[data-id="${main.gedcom_id}"]`); card?.classList.add('search-hit'); showDetails(main.gedcom_id); }
    else if(matches[0]){ openSiblingDrawer(matches[0].cluster); setTimeout(()=>{const item=els.siblingTrack.querySelector(`[data-id="${matches[0].gedcom_id}"]`); item?.scrollIntoView({behavior:'smooth',inline:'center'});},120); }
    else showToast('No matching person in this prototype.');
  }
  function transform(){ els.stage.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`; }
  function fit(){ const rect=els.viewport.getBoundingClientRect(); state.scale=Math.min((rect.width-40)/STAGE.width,(rect.height-40)/STAGE.height,1); state.x=(rect.width-STAGE.width*state.scale)/2; state.y=(rect.height-STAGE.height*state.scale)/2; transform(); }
  function zoom(delta, cx=null, cy=null){ const rect=els.viewport.getBoundingClientRect(); const old=state.scale; const next=Math.max(.32,Math.min(1.45,old+delta)); cx ??=rect.width/2; cy ??=rect.height/2; const sx=(cx-state.x)/old, sy=(cy-state.y)/old; state.scale=next; state.x=cx-sx*next; state.y=cy-sy*next; transform(); }
  function wireControls(){
    els.detailClose.addEventListener('click',closeDetails); els.siblingClose.addEventListener('click',closeSiblingDrawer); els.fit.addEventListener('click',fit); els.zoomIn.addEventListener('click',()=>zoom(.12)); els.zoomOut.addEventListener('click',()=>zoom(-.12));
    els.filters.addEventListener('click',e=>{const b=e.target.closest('button[data-branch]');if(!b)return; state.branch=b.dataset.branch; els.filters.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));applyBranchFilter();});
    els.search.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();}); let searchTimer; els.search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(doSearch,350);});
    els.viewport.addEventListener('wheel',e=>{e.preventDefault();const r=els.viewport.getBoundingClientRect();zoom(e.deltaY>0?-.07:.07,e.clientX-r.left,e.clientY-r.top);},{passive:false});
    els.viewport.addEventListener('pointerdown',e=>{if(e.target.closest('.person-card'))return;state.dragging=true;state.dragStart={x:e.clientX,y:e.clientY,ox:state.x,oy:state.y};els.viewport.classList.add('dragging');els.viewport.setPointerCapture(e.pointerId);});
    els.viewport.addEventListener('pointermove',e=>{if(!state.dragging)return;state.x=state.dragStart.ox+(e.clientX-state.dragStart.x);state.y=state.dragStart.oy+(e.clientY-state.dragStart.y);transform();});
    const stop=e=>{state.dragging=false;els.viewport.classList.remove('dragging');try{els.viewport.releasePointerCapture(e.pointerId)}catch{}}; els.viewport.addEventListener('pointerup',stop);els.viewport.addEventListener('pointercancel',stop);
    window.addEventListener('resize',fit);
  }
  function showToast(msg){ els.toast.textContent=msg;els.toast.classList.add('show');setTimeout(()=>els.toast.classList.remove('show'),1800); }
  async function init(){ try{await loadData();buildIndex();renderCards();renderConnectors();wireControls();requestAnimationFrame(fit);}catch(err){console.error(err);els.source.textContent='Data load failed';showToast('The family data could not be loaded.');} }
  init();
})();
