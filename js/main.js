(function () {
  const listEl = document.getElementById("module-list");
  const searchEl = document.getElementById("topic-search");

  const moduleColorVar = {
    fundamentals: "var(--fund)",
    layer2: "var(--l2)",
    layer3: "var(--l3)",
    layer4: "var(--l4)",
    "app-naming": "var(--app)",
    security: "var(--sec)",
  };

  function render() {
    const frag = document.createDocumentFragment();

    SITE_DATA.forEach((mod) => {
      const section = document.createElement("section");
      section.className = "module";
      section.dataset.moduleId = mod.id;
      section.style.setProperty("--module-color", moduleColorVar[mod.id] || "var(--l2)");

      const head = document.createElement("div");
      head.className = "module-head";
      head.innerHTML = `
        <h2>${mod.title}</h2>
        <p>${mod.blurb}</p>
      `;

      const list = document.createElement("ul");
      list.className = "topic-list";

      mod.topics.forEach((topic) => {
        const li = document.createElement("li");
        const isPublished = topic.status === "published";
        const tag = isPublished ? "a" : "div";
        const row = document.createElement(tag);
        row.className = "topic-row" + (isPublished ? "" : " is-planned");
        row.dataset.title = topic.title.toLowerCase();
        if (isPublished) {
          row.href = `topics/${topic.slug}.html`;
        }
        row.innerHTML = `
          <span class="t-title">${topic.title}</span>
          <span class="status-chip ${topic.status}">${isPublished ? "read" : "planned"}</span>
        `;
        li.appendChild(row);
        list.appendChild(li);
      });

      section.appendChild(head);
      section.appendChild(list);
      frag.appendChild(section);
    });

    listEl.appendChild(frag);
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    let anyVisible = false;

    document.querySelectorAll(".module").forEach((mod) => {
      let moduleHasMatch = false;
      mod.querySelectorAll(".topic-row").forEach((row) => {
        const match = !q || row.dataset.title.includes(q);
        row.closest("li").hidden = !match;
        if (match) moduleHasMatch = true;
      });
      mod.hidden = !moduleHasMatch;
      if (moduleHasMatch) anyVisible = true;
    });

    let noResults = document.getElementById("no-results");
    if (!anyVisible) {
      if (!noResults) {
        noResults = document.createElement("p");
        noResults.id = "no-results";
        noResults.className = "no-results";
        noResults.textContent = "No topics match that search.";
        listEl.appendChild(noResults);
      }
    } else if (noResults) {
      noResults.remove();
    }
  }

  render();

  if (searchEl) {
    searchEl.addEventListener("input", (e) => filter(e.target.value));
  }
})();
