function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return "Unknown Site";
  }
}

async function findOrCreateDomainPage(domain, notionToken, webNotesPageId) {
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${webNotesPageId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      filter: {
        property: "Name",
        title: { equals: domain }
      }
    })
  }).then(r => r.json());

  if (searchRes.results && searchRes.results.length > 0) {
    return searchRes.results[0].id; // page_id of the database row
  }

  const createRes = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      parent: { database_id: webNotesPageId },
      properties: {
        Name: { title: [{ text: { content: domain } }] }
      }
    })
  }).then(r => r.json());

  return createRes.id;
}

async function appendHighlightBullet(domainPageId, highlight, notionToken) {
  const bulletChildren = [];

  // Bold highlight text
  bulletChildren.push({
    type: "text",
    text: { content: highlight.text + " " },
    annotations: { bold: true }
  });

  // Italic note if exists
  if (highlight.note) {
    bulletChildren.push({
      type: "text",
      text: { content: `(Note: ${highlight.note}) ` },
      annotations: { italic: true }
    });
  }

  // Color label
  bulletChildren.push({
    type: "text",
    text: { content: `[${highlight.color}] ` }
  });

  // Grey timestamp
  bulletChildren.push({
    type: "text",
    text: { content: "- " + new Date(highlight.timestamp).toLocaleString() },
    annotations: { color: "gray" }
  });

  await fetch(`https://api.notion.com/v1/blocks/${domainPageId}/children`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: bulletChildren
          }
        }
      ]
    })
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveHighlight') {
    chrome.storage.local.get({ highlights: [], notionToken: "", webNotesPageId: "" }, async (res) => {
      const arr = res.highlights || [];
      arr.push(message.highlight);
      chrome.storage.local.set({ highlights: arr });

      if (res.notionToken && res.webNotesPageId) {
        const domain = getDomainFromUrl(message.highlight.url);
        try {
          const domainPageId = await findOrCreateDomainPage(domain, res.notionToken, res.webNotesPageId);
          await appendHighlightBullet(domainPageId, message.highlight, res.notionToken);
          console.log(`Highlight added to Notion bullet list under ${domain}`);
        } catch (err) {
          console.error("Error syncing to Notion:", err);
        }
      }
    });
  } 
  else if (message.type === 'deleteHighlight') {
    chrome.storage.local.get({ highlights: [] }, (res) => {
      const arr = (res.highlights || []).filter(h => h.id !== message.id);
      chrome.storage.local.set({ highlights: arr });
    });
  } 
  else if (message.type === 'getHighlights') {
    chrome.storage.local.get({ highlights: [] }, (res) => {
      sendResponse({ highlights: res.highlights || [] });
    });
    return true;
  }
});