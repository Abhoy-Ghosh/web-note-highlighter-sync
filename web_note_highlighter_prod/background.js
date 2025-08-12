chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveHighlight') {
    chrome.storage.local.get({highlights:[]}, (res) => {
      const arr = res.highlights || [];
      arr.push(message.highlight);
      chrome.storage.local.set({highlights: arr});
    });
  } else if (message.type === 'deleteHighlight') {
    chrome.storage.local.get({highlights:[]}, (res) => {
      const arr = (res.highlights || []).filter(h => h.id !== message.id);
      chrome.storage.local.set({highlights: arr});
    });
  } else if (message.type === 'getHighlights') {
    chrome.storage.local.get({highlights:[]}, (res) => {
      sendResponse({highlights: res.highlights || []});
    });
    return true;
  }
});
