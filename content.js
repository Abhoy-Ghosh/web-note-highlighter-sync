// --- Utilities ---

function getXPath(element) {
  if (element.id !== '') return `id("${element.id}")`;
  if (element === document.body) return 'html[1]/body[1]';

  const ix = Array.from(element.parentNode.children).filter(
    sibling => sibling.tagName === element.tagName
  ).indexOf(element) + 1;

  return `${getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix}]`;
}

function getElementByXPath(xpath) {
  try {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  } catch (e) {
    console.error('Invalid XPath:', xpath);
    return null;
  }
}

function highlightText(text, xpath, color) {
  const element = getElementByXPath(xpath);
  if (!element || !text) return;

  const innerHTML = element.innerHTML;
  const index = innerHTML.indexOf(text);
  if (index === -1) return;

  const highlightedHTML =
    innerHTML.substring(0, index) +
    `<span style="background-color: ${color}; border-radius: 3px;">${text}</span>` +
    innerHTML.substring(index + text.length);

  element.innerHTML = highlightedHTML;
}

// --- Apply stored highlights on load ---

chrome.storage.local.get(["highlights"], (result) => {
  if (result.highlights && Array.isArray(result.highlights)) {
    result.highlights
      .filter(h => h.url === window.location.href)
      .forEach(({ text, xpath, color }) => {
        highlightText(text, xpath, color);
      });
  }
});

// --- Handle new selection & floating "+" button ---

let plusBtn = document.createElement("button");
plusBtn.textContent = "+";
plusBtn.style.position = "absolute";
plusBtn.style.display = "none";
plusBtn.style.zIndex = "9999";
plusBtn.style.background = "#2196F3";
plusBtn.style.color = "white";
plusBtn.style.border = "none";
plusBtn.style.borderRadius = "50%";
plusBtn.style.padding = "4px 4px";
plusBtn.style.cursor = "pointer";

document.body.appendChild(plusBtn);

let selectionRange = null;

document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  if (selection.toString().trim().length === 0) {
    plusBtn.style.display = "none";
    return;
  }

  selectionRange = selection.getRangeAt(0);
  const rect = selectionRange.getBoundingClientRect();

  plusBtn.style.top = `${rect.top + window.scrollY - 30}px`;
  plusBtn.style.left = `${rect.left + window.scrollX}px`;
  plusBtn.style.display = "block";
});

plusBtn.addEventListener("click", () => {
  plusBtn.style.display = "none";

  const colorPicker = document.createElement("div");
  colorPicker.style.position = "absolute";
  colorPicker.style.top = plusBtn.style.top;
  colorPicker.style.left = `${parseInt(plusBtn.style.left) + 30}px`;
  colorPicker.style.zIndex = "9999";
  colorPicker.style.display = "flex";
  colorPicker.style.gap = "5px";

  const colors = [
    { name: "Yellow", code: "#FFD740" },
    { name: "Red", code: "#FF5252" },
    { name: "Green", code: "#69F0AE" },
    { name: "Pink", code: "#f321e9f1"}
  ];

  colors.forEach(({ name, code }) => {
    const btn = document.createElement("button");
    btn.style.background = code;
    btn.style.width = "20px";
    btn.style.height = "20px";
    btn.style.border = "1px solid #ccc";
    btn.style.borderRadius = "50%";
    btn.title = name;
    btn.addEventListener("click", () => {
      const selectedText = selectionRange.toString();
      const span = document.createElement("span");
      span.style.backgroundColor = code;
      span.style.borderRadius = "3px";
      span.textContent = selectedText;

      selectionRange.deleteContents();
      selectionRange.insertNode(span);

      const xpath = getXPath(span.parentNode);
      const highlight = {
        text: selectedText,
        color: code,
        xpath,
        url: window.location.href
      };

      chrome.storage.local.get(["highlights"], (result) => {
        const highlights = result.highlights || [];
        highlights.push(highlight);
        chrome.storage.local.set({ highlights });
      });

      colorPicker.remove();
    });

    colorPicker.appendChild(btn);
  });

  document.body.appendChild(colorPicker);
});


chrome.storage.local.get("highlights", (result) => {
  console.log("Stored highlights:", result.highlights);
});
