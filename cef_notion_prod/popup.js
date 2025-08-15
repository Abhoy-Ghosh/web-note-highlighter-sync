function renderList(highlights){
  const container = document.getElementById('list');
  container.innerHTML = '';
  if(!highlights.length){ 
    container.innerHTML = '<div style="color:#666">No highlights found for this page.</div>'; 
    return; 
  }
  highlights.forEach(h => {
    const el = document.createElement('div'); el.className='hl';
    el.innerHTML = `<div>${h.text.length>200? h.text.slice(0,200)+'...': h.text}</div>
      <div class="meta">${h.color} • ${h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}${h.note ? ' • Note: '+h.note : ''}</div>`;
    const del = document.createElement('button'); del.textContent='Delete'; del.className='btn-delete';
    del.addEventListener('click', ()=>{
      chrome.runtime.sendMessage({ type:'deleteHighlight', id: h.id });
      setTimeout(load,200);
    });
    el.appendChild(del);
    container.appendChild(el);
  });
}

function load(){
  chrome.tabs.query({active:true,currentWindow:true}, (tabs)=>{
    const tab = tabs[0];
    if(!tab) return;
    chrome.runtime.sendMessage({ type:'getHighlights' }, (res)=>{
      const all = res && res.highlights ? res.highlights : [];
      const page = all.filter(x=> x.url === tab.url);
      renderList(page);
    });
  });
}

document.getElementById('refresh').addEventListener('click', load);
document.getElementById('clearLocal').addEventListener('click', ()=>{
  chrome.tabs.query({active:true,currentWindow:true}, (tabs)=>{
    const tab = tabs[0]; if(!tab) return;
    chrome.runtime.sendMessage({ type:'getHighlights' }, (res)=>{
      const all = res && res.highlights ? res.highlights : [];
      const page = all.filter(x=> x.url === tab.url);
      const ids = page.map(p=>p.id);
      ids.forEach(id => chrome.runtime.sendMessage({ type:'deleteHighlight', id: id }));
      setTimeout(load,300);
    });
  });
});

// Load Notion settings into form
chrome.storage.local.get(["notionToken", "webNotesPageId"], (res) => {
  if (res.notionToken) document.getElementById("notionToken").value = res.notionToken;
  if (res.webNotesPageId) document.getElementById("webNotesPageId").value = res.webNotesPageId;
});

// Save Notion settings
document.getElementById("saveNotion").addEventListener("click", () => {
  const notionToken = document.getElementById("notionToken").value.trim();
  const webNotesPageId = document.getElementById("webNotesPageId").value.trim();

  chrome.storage.local.set({ notionToken, webNotesPageId }, () => {
    alert("Notion settings saved!");
  });
});

load();
