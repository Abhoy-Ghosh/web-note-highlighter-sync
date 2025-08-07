chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveHighlight") {
    chrome.storage.local.get({ highlights: [] }, (data) => {
      const updated = data.highlights.filter(h => !(h.url === message.url && h.text === message.text));
      updated.push({
        text: message.text,
        url: message.url,
        color: message.color,
        xpath: message.xpath
      });
      chrome.storage.local.set({ highlights: updated });
    });
  }
});