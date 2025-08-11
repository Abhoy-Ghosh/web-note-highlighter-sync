chrome.storage.local.get({ highlights: [] }, (data) => {
  const list = document.getElementById("list");
  data.highlights.filter(h => h.url === location.href).forEach(h => {
    const li = document.createElement("li");
    li.textContent = h.text + " (" + h.color + ")";
    list.appendChild(li);
  });
});