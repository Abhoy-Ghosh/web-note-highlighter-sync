/* content.js – Final Highlighter with Notion + Local Storage sync
   - Highlight text with Yellow, Red, Green, or Transparent
   - Add optional note
   - Save via color click or Save button
   - Cancel closes popup
   - Restore highlights on page reload
   - Delete button removes from both storage + Notion
*/

(function(){
  // ===== Utilities =====
  function genId(){ return 'hn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function xpathForElement(el){
    if(!el) return '';
    if(el.id) return `id("${el.id}")`;
    if(el===document.body) return 'html[1]/body[1]';
    const idx = Array.from(el.parentNode.children).filter(c=>c.tagName===el.tagName).indexOf(el)+1;
    return xpathForElement(el.parentNode) + `/${el.tagName.toLowerCase()}[${idx}]`;
  }
  function getElementByXPath(xpath){
    try{ return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }catch(e){ return null; }
  }

  // ===== Styles =====
  const style = document.createElement('style');
  style.textContent = `
  .hn-highlight{padding:0.08em;border-radius:3px;display:inline;position:relative}
  .hn-wrapper{position:relative;display:inline-block}
  .hn-del{position:absolute;right:-20px;top:-6px;background:rgba(255,255,255,0.95);border:1px solid #ccc;border-radius:4px;display:none;cursor:pointer;padding:0 4px}
  .hn-plus{position:absolute;z-index:2147483647;display:none;background:#1976d2;color:#fff;border:none;border-radius:50%;width:34px;height:34px;align-items:center;justify-content:center;font-weight:bold;cursor:pointer}
  .hn-picker{position:absolute;z-index:2147483647;display:none;padding:10px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.15);width:260px}
  .hn-color{width:28px;height:28px;border-radius:50%;border:1px solid #999;display:inline-block;margin-right:8px;cursor:pointer;vertical-align:middle}
  .hn-note{width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical}
  .hn-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}
  .hn-save{padding:6px 10px;background:#1976d2;color:#fff;border:none;border-radius:6px;cursor:pointer}
  .hn-cancel{padding:6px 10px;background:#f0f0f0;border:1px solid #ccc;border-radius:6px;cursor:pointer}
  `;
  document.head.appendChild(style);

  // ===== UI Elements =====
  const plus = document.createElement('button'); plus.className='hn-plus'; plus.textContent='+';
  const picker = document.createElement('div'); picker.className='hn-picker';

  const colors = [
    {name:'Yellow',c:'#FFD740'},
    {name:'Red',c:'#FF5252'},
    {name:'Green',c:'#69F0AE'},
    {name:'Transparent',c:'transparent'}
  ];
  const row = document.createElement('div');
  colors.forEach(col => {
    const d = document.createElement('div'); 
    d.className='hn-color'; 
    d.title=col.name; 
    d.dataset.color = col.c; 
    d.style.background = col.c==='transparent' ? '#fff' : col.c;
    row.appendChild(d);
  });
  picker.appendChild(row);

  const noteInput = document.createElement('textarea'); 
  noteInput.className='hn-note'; 
  noteInput.placeholder='Optional note...'; 
  noteInput.rows=3;
  picker.appendChild(noteInput);

  const actions = document.createElement('div'); actions.className='hn-actions';
  const saveBtn = document.createElement('button'); saveBtn.className='hn-save'; saveBtn.textContent='Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className='hn-cancel'; cancelBtn.textContent='Cancel';
  actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
  picker.appendChild(actions);

  document.body.appendChild(plus); 
  document.body.appendChild(picker);

  // ===== Helpers =====
  function hidePopup(){ 
    picker.style.display='none'; 
    plus.style.display='none'; 
    noteInput.value=''; 
    currentRange = null; 
  }
  function showPickerAt(x,y){ 
    picker.style.left = x + 'px'; 
    picker.style.top = y; 
    picker.style.display='block'; 
    noteInput.focus(); 
  }

function wrapRangeSafely(range, opts){
  if(!range || range.collapsed) return null;
  const id = opts?.id || genId();
  const color = opts?.color || 'transparent';
  const note = opts?.note || '';
  const text = range.toString();

  const span = document.createElement('span'); 
  span.className='hn-highlight'; 

  // ✅ Always re-apply the saved color on restore
  if (color && color !== 'transparent') {
    span.style.backgroundColor = color;
  }

  span.dataset.hnId = id; 
  span.dataset.hnNote = note; 
  span.dataset.hnText = text;
  span.dataset.hnColor = color;   // stored for debugging / editing

  const wrapper = document.createElement('span'); 
  wrapper.className='hn-wrapper'; 
  wrapper.dataset.hnId = id;
  span.appendChild(document.createTextNode(text));
  wrapper.appendChild(span);

  const del = document.createElement('button'); 
  del.className='hn-del'; 
  del.textContent='🗑'; 
  del.title='Delete highlight';
  del.addEventListener('click', (ev) => {
    ev.stopPropagation(); ev.preventDefault();
    chrome.runtime.sendMessage({ type: 'deleteHighlight', id: id });
    wrapper.replaceWith(document.createTextNode(span.textContent));
  });
  wrapper.appendChild(del);

  wrapper.addEventListener('mouseenter', ()=> del.style.display='inline-block');
  wrapper.addEventListener('mouseleave', ()=> del.style.display='none');

  range.deleteContents();
  range.insertNode(wrapper);
  return { id, node: wrapper, text, color, note };
}


  function persistHighlight(meta){
    console.log("Saving highlight:", meta);
    chrome.runtime.sendMessage({ type: 'saveHighlight', highlight: meta });
    chrome.runtime.sendMessage({ type: 'sendToNotion', highlight: meta });
  }

  function restoreHighlights(){
    chrome.storage.local.get({ highlights: [] }, (res) => {
      const arr = res.highlights || [];
      const url = window.location.href;
     arr.filter(h=>h.url===url).forEach(h=>{
  if(document.querySelector(`[data-hn-id="${h.id}"]`)) return;
  const container = getElementByXPath(h.xpath) || document.body;
  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  while(walker.nextNode()){
    const t = walker.currentNode;
    const idx = t.nodeValue.indexOf(h.text);
    if(idx !== -1){
      range.setStart(t, idx);
      range.setEnd(t, idx + h.text.length);
      // ✅ Pass h.color so it's restored
      wrapRangeSafely(range, { id: h.id, color: h.color, note: h.note });
      break;
    }
  }
});
 });
  }

  // ===== Core Save Logic =====
  function applyHighlightAndSave(color){
    if(!currentRange) return;
    const note = noteInput.value.trim();
    const text = currentRange.toString();
    const wrap = wrapRangeSafely(currentRange, { color, note });

    if(wrap){
      const xpath = xpathForElement(wrap.node);
      const meta = { 
        id: wrap.id, 
        text, 
        color, 
        note, 
        url: window.location.href, 
        xpath, 
        timestamp: new Date().toISOString() 
      };
      persistHighlight(meta);
    }

    hidePopup();
    window.getSelection().removeAllRanges();
  }

  // ===== Events =====
  let currentRange = null;
  document.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    if(!sel || sel.isCollapsed || !sel.toString().trim()){ hidePopup(); return; }
    try{ currentRange = sel.getRangeAt(0).cloneRange(); }catch(e){ currentRange = null; hidePopup(); return; }
    const rect = currentRange.getBoundingClientRect();
    plus.style.left = (rect.left + window.scrollX) + 'px';
    plus.style.top = (rect.top + window.scrollY - 44) + 'px';
    plus.style.display = 'flex';
  });

  plus.addEventListener('click', (e) => {
    e.stopPropagation();
    plus.style.display='none';
    if(!currentRange) return;
    const left = parseInt(plus.style.left) + 42;
    const top = plus.style.top;
    showPickerAt(left, top);
  });

  picker.addEventListener('click', (e) => {
    const colorEl = e.target.closest('.hn-color');
    if(colorEl){ applyHighlightAndSave(colorEl.dataset.color); }
  });

  saveBtn.addEventListener('click', () => { applyHighlightAndSave('transparent'); });
  cancelBtn.addEventListener('click', () => { hidePopup(); });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ hidePopup(); } });

  // ===== Init =====
(function(){
  // Utilities
  function genId(){ return 'hn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function xpathForElement(el){
    if(!el) return '';
    if(el.id) return `id("${el.id}")`;
    if(el===document.body) return 'html[1]/body[1]';
    const idx = Array.from(el.parentNode.children).filter(c=>c.tagName===el.tagName).indexOf(el)+1;
    return xpathForElement(el.parentNode) + `/${el.tagName.toLowerCase()}[${idx}]`;
  }
  function getElementByXPath(xpath){
    try{ return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }catch(e){ return null; }
  }

  // Styles
  const style = document.createElement('style');
  style.textContent = `
  .hn-highlight{padding:0.08em;border-radius:3px;display:inline;position:relative}
  .hn-wrapper{position:relative;display:inline-block}
  .hn-del{position:absolute;right:-20px;top:-6px;background:rgba(255,255,255,0.95);border:1px solid #ccc;border-radius:4px;display:none;cursor:pointer;padding:0 4px}
  .hn-plus{position:absolute;z-index:2147483647;display:none;background:#1976d2;color:#fff;border:none;border-radius:50%;width:34px;height:34px;align-items:center;justify-content:center;font-weight:bold;cursor:pointer}
  .hn-picker{position:absolute;z-index:2147483647;display:none;padding:10px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.15);width:260px}
  .hn-color{width:28px;height:28px;border-radius:50%;border:1px solid #999;display:inline-block;margin-right:8px;cursor:pointer;vertical-align:middle}
  .hn-note{width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #ddd;border-radius:4px;resize:vertical}
  .hn-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}
  .hn-save{padding:6px 10px;background:#1976d2;color:#fff;border:none;border-radius:6px;cursor:pointer}
  .hn-cancel{padding:6px 10px;background:#f0f0f0;border:1px solid #ccc;border-radius:6px;cursor:pointer}
  `;
  document.head.appendChild(style);

  // UI elements
  const plus = document.createElement('button'); plus.className='hn-plus'; plus.textContent='+';
  const picker = document.createElement('div'); picker.className='hn-picker';
  const colors = [
    {name:'Yellow',c:'#FFD740'},
    {name:'Red',c:'#FF5252'},
    {name:'Green',c:'#69F0AE'},
    {name:'Transparent',c:'transparent'}
  ];
  const row = document.createElement('div');
  colors.forEach(col => {
    const d = document.createElement('div'); 
    d.className='hn-color'; 
    d.title=col.name; 
    d.dataset.color = col.c; 
    d.style.background = col.c==='transparent' ? '#fff' : col.c;
    row.appendChild(d);
  });
  picker.appendChild(row);
  const noteInput = document.createElement('textarea'); 
  noteInput.className='hn-note'; 
  noteInput.placeholder='Optional note... (press Save when done)'; 
  noteInput.rows=3;
  picker.appendChild(noteInput);
  const actions = document.createElement('div'); actions.className='hn-actions';
  const saveBtn = document.createElement('button'); saveBtn.className='hn-save'; saveBtn.textContent='Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className='hn-cancel'; cancelBtn.textContent='Cancel';
  actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
  picker.appendChild(actions);

  document.body.appendChild(plus); 
  document.body.appendChild(picker);

  function hideUI(){ 
    plus.style.display='none'; 
    picker.style.display='none'; 
    noteInput.value=''; 
    currentRange = null; 
  }

  function showPickerAt(x,y){ 
    picker.style.left = x + 'px'; 
    picker.style.top = y; 
    picker.style.display='block'; 
    noteInput.focus(); 
  }

  // Wrapping highlights
  function wrapRangeSafely(range, opts){
    if(!range || range.collapsed) return null;
    const id = opts?.id || genId();
    const color = opts?.color || 'transparent';
    const note = opts?.note || '';
    const text = range.toString();

    const span = document.createElement('span'); 
    span.className='hn-highlight'; 
    if(color !== 'transparent') span.style.backgroundColor = color;
    span.dataset.hnId = id; 
    span.dataset.hnNote = note; 
    span.dataset.hnText = text;

    const wrapper = document.createElement('span'); 
    wrapper.className='hn-wrapper'; 
    wrapper.dataset.hnId = id;
    span.appendChild(document.createTextNode(text));
    wrapper.appendChild(span);

    const del = document.createElement('button'); 
    del.className='hn-del'; 
    del.textContent='🗑'; 
    del.title='Delete highlight';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      chrome.runtime.sendMessage({ type: 'deleteHighlight', id: id });
      wrapper.replaceWith(document.createTextNode(span.textContent));
    });
    wrapper.appendChild(del);

    wrapper.addEventListener('mouseenter', ()=> del.style.display='inline-block');
    wrapper.addEventListener('mouseleave', ()=> del.style.display='none');

    range.deleteContents();
    range.insertNode(wrapper);
    return { id, node: wrapper };
  }

  function persistHighlight(meta){
    console.log("Saving highlight:", meta);
    chrome.runtime.sendMessage({ type: 'saveHighlight', highlight: meta });
  }

  function restoreHighlights(){
    chrome.storage.local.get({ highlights: [] }, (res) => {
      console.log("Restoring highlights:", res.highlights);
      const arr = res.highlights || [];
      const url = window.location.href;
      arr.filter(h=>h.url===url).forEach(h=>{
        if(document.querySelector(`[data-hn-id="${h.id}"]`)) return;
        const container = getElementByXPath(h.xpath) || document.body;
        const range = document.createRange();
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        while(walker.nextNode()){
          const t = walker.currentNode;
          const idx = t.nodeValue.indexOf(h.text);
          if(idx !== -1){
            range.setStart(t, idx);
            range.setEnd(t, idx + h.text.length);
            wrapRangeSafely(range, { id: h.id, color: h.color, note: h.note });
            break;
          }
        }
      });
    });
  }

  // Selection + UI
  let currentRange = null;
  document.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    if(!sel || sel.isCollapsed || !sel.toString().trim()){ return; }
    try{ currentRange = sel.getRangeAt(0).cloneRange(); }catch(e){ currentRange = null; return; }
    const rect = currentRange.getBoundingClientRect();
    plus.style.left = (rect.left + window.scrollX) + 'px';
    plus.style.top = (rect.top + window.scrollY - 44) + 'px';
    plus.style.display = 'flex';
  });

  plus.addEventListener('click', (e) => {
    e.stopPropagation();
    plus.style.display='none';
    if(!currentRange) return;
    const left = parseInt(plus.style.left) + 42;
    const top = plus.style.top;
    showPickerAt(left, top);
  });

  picker.addEventListener('click', (e) => {
    const colorEl = e.target.closest('.hn-color');
    if(colorEl && currentRange){
      const color = colorEl.dataset.color;
      const note = noteInput.value.trim();
      const text = currentRange.toString();
      const wrap = wrapRangeSafely(currentRange, { color, note });
      if(wrap){
        const xpath = xpathForElement(wrap.node);
        const meta = { id: wrap.id, text, color, note, url: window.location.href, xpath, timestamp: new Date().toISOString() };
        persistHighlight(meta);
      }
      hideUI();
      window.getSelection().removeAllRanges();
    }
  });

saveBtn.addEventListener('click', () => {
  if(!currentRange){ hideUI(); return; }

  const note = noteInput.value.trim();
  const text = currentRange.toString();

  // Always hide popup immediately
  hideUI();

  const wrap = wrapRangeSafely(currentRange, { color: 'transparent', note });
  if(wrap){
    const xpath = xpathForElement(wrap.node);
    const meta = { 
      id: wrap.id, 
      text: wrap.text, 
      color: 'transparent', 
      note, 
      url: window.location.href, 
      xpath, 
      timestamp: new Date().toISOString() 
    };
    persistHighlight(meta);
  }
  window.getSelection().removeAllRanges();
});


  cancelBtn.addEventListener('click', () => { hideUI(); });

  // Init
  restoreHighlights();
})();

//////////////////////////////////////////////////////////////////////

function persistHighlight(meta){
    console.log("Saving highlight:", meta);
    chrome.runtime.sendMessage({ type: 'saveHighlight', highlight: meta });
}

function restoreHighlights(){
    chrome.storage.local.get({ highlights: [] }, (res) => {
        console.log("Restoring highlights:", res.highlights);
      });
}
  restoreHighlights();
})();
