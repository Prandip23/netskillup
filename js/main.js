(function () {
  const listEl = document.getElementById("module-list");
  const searchEl = document.getElementById("topic-search");
  const clearSearchEl = document.getElementById("clear-search");
  const moduleJumpEl = document.getElementById("module-jump");
  const curriculumSummaryEl = document.getElementById("curriculum-summary");
  const searchResultsEl = document.getElementById("search-results");
  const noResultsEl = document.getElementById("no-results");

  const moduleColorVar = {
    fundamentals: "var(--fund)",
    layer2: "var(--l2)",
    layer3: "var(--l3)",
    layer4: "var(--l4)",
    "app-naming": "var(--app)",
    security: "var(--sec)",
  };

  function topicCountLabel(count) {
    return `${count} ${count === 1 ? "topic" : "topics"}`;
  }

  function renderModuleJump() {
    if (!moduleJumpEl) return;

    const fragment = document.createDocumentFragment();

    SITE_DATA.forEach((module) => {
      const link = document.createElement("a");
      link.href = `#module-${module.id}`;
      link.style.setProperty("--module-color", moduleColorVar[module.id] || "var(--l2)");

      const number = document.createElement("span");
      number.className = "module-jump-number";
      number.textContent = module.number;

      const title = document.createElement("span");
      title.textContent = module.title;

      link.append(number, title);
      fragment.appendChild(link);
    });

    moduleJumpEl.appendChild(fragment);
  }

  function render() {
    const frag = document.createDocumentFragment();

    SITE_DATA.forEach((mod) => {
      const section = document.createElement("section");
      section.className = "module";
      section.dataset.moduleId = mod.id;
      section.id = `module-${mod.id}`;
      section.style.setProperty("--module-color", moduleColorVar[mod.id] || "var(--l2)");

      const head = document.createElement("div");
      head.className = "module-head";
      const moduleLabel = document.createElement("p");
      moduleLabel.className = "module-label";
      moduleLabel.textContent = `MODULE ${mod.number}`;
      const heading = document.createElement("h2");
      heading.id = `module-${mod.id}-heading`;
      heading.textContent = mod.title;
      const blurb = document.createElement("p");
      blurb.textContent = mod.blurb;
      const count = document.createElement("span");
      count.className = "module-count";
      count.textContent = topicCountLabel(mod.topics.length);
      head.append(moduleLabel, heading, blurb, count);
      section.setAttribute("aria-labelledby", heading.id);

      const list = document.createElement("ul");
      list.className = "topic-list";

      mod.topics.forEach((topic, index) => {
        const li = document.createElement("li");
        const isPublished = topic.status === "published";
        const tag = isPublished ? "a" : "div";
        const row = document.createElement(tag);
        row.className = "topic-row" + (isPublished ? "" : " is-planned");
        row.dataset.topic = topic.title.toLowerCase();
        row.dataset.module = `${mod.number} ${mod.tag} ${mod.title}`.toLowerCase();
        if (isPublished) {
          row.href = `topics/${topic.slug}.html`;
        }

        const order = document.createElement("span");
        order.className = "topic-order";
        order.textContent = String(index + 1).padStart(2, "0");

        const title = document.createElement("span");
        title.className = "t-title";
        title.textContent = topic.title;

        const tail = document.createElement("span");
        tail.className = "topic-tail";
        if (isPublished) {
          tail.setAttribute("aria-hidden", "true");
          tail.textContent = "→";
        } else {
          tail.classList.add("status-chip", topic.status);
          tail.textContent = "planned";
        }

        row.append(order, title, tail);
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
    const normalizedQuery = query.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    let visibleTopicCount = 0;

    document.querySelectorAll(".module").forEach((mod) => {
      let moduleHasMatch = false;
      mod.querySelectorAll(".topic-row").forEach((row) => {
        const match = !queryTerms.length || [row.dataset.topic, row.dataset.module].some((searchText) =>
          queryTerms.every((term) => searchText.includes(term))
        );
        row.closest("li").hidden = !match;
        if (match) {
          moduleHasMatch = true;
          visibleTopicCount += 1;
        }
      });
      mod.hidden = !moduleHasMatch;
    });

    if (noResultsEl) {
      noResultsEl.hidden = visibleTopicCount !== 0;
    }
    if (searchResultsEl) {
      searchResultsEl.textContent = normalizedQuery
        ? `${topicCountLabel(visibleTopicCount)} found for “${query.trim()}”.`
        : `${topicCountLabel(visibleTopicCount)} across ${SITE_DATA.length} modules.`;
    }
    if (clearSearchEl) {
      clearSearchEl.hidden = !normalizedQuery;
    }
  }

  render();
  renderModuleJump();

  const totalTopics = SITE_DATA.reduce((sum, module) => sum + module.topics.length, 0);
  if (curriculumSummaryEl) {
    curriculumSummaryEl.textContent = `${topicCountLabel(totalTopics)} across ${SITE_DATA.length} modules, from Ethernet frames to encrypted tunnels.`;
  }

  filter("");

  if (searchEl) {
    searchEl.addEventListener("input", (e) => filter(e.target.value));
    searchEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && searchEl.value) {
        searchEl.value = "";
        filter("");
      }
    });
  }

  if (clearSearchEl && searchEl) {
    clearSearchEl.addEventListener("click", () => {
      searchEl.value = "";
      filter("");
      searchEl.focus();
    });
  }
})();
