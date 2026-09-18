(function () {
  const searchEl = document.getElementById("topic-search");
  const clearSearchEl = document.getElementById("clear-search");
  const levelEl = document.getElementById("topic-level");
  const searchResultsEl = document.getElementById("search-results");
  const noResultsEl = document.getElementById("no-results");
  if (!searchEl) return;

  const modules = Array.from(document.querySelectorAll(".module"), (element) => ({
    element,
    rows: Array.from(element.querySelectorAll(".topic-row")),
    count: element.querySelector(".module-count"),
    list: element.querySelector(".topic-list"),
    jump: document.querySelector(`.module-jump a[href="#${element.id}"]`),
  }));

  function topicCountLabel(count) {
    return `${count} ${count === 1 ? "topic" : "topics"}`;
  }

  function filter(updateURL = true) {
    const query = searchEl.value.trim();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const level = levelEl?.value || "";
    let visibleTopicCount = 0;
    let visibleModuleCount = 0;

    modules.forEach(({ element, rows, count, list, jump }) => {
      let moduleCount = 0;
      const ranked = rows.map((row, index) => {
        const match = (!level || row.dataset.level === level) && terms.every((term) => row.dataset.search.includes(term));
        row.closest("li").hidden = !match;
        if (match) moduleCount += 1;
        const score = terms.filter((term) => row.dataset.topic.includes(term)).length;
        return { row, index, score };
      });
      ranked.sort((left, right) => right.score - left.score || left.index - right.index);
      ranked.forEach(({ row }) => list.appendChild(row.closest("li")));
      element.hidden = moduleCount === 0;
      if (jump) jump.hidden = element.hidden;
      count.textContent = moduleCount === rows.length ? topicCountLabel(moduleCount) : `${moduleCount} of ${topicCountLabel(rows.length)}`;
      visibleTopicCount += moduleCount;
      if (moduleCount) visibleModuleCount += 1;
    });

    noResultsEl.hidden = visibleTopicCount !== 0;
    searchResultsEl.textContent = query
      ? `${topicCountLabel(visibleTopicCount)} found for "${query}"${level ? ` (${level})` : ""}.`
      : `${topicCountLabel(visibleTopicCount)} across ${visibleModuleCount} modules${level ? ` (${level})` : ""}.`;
    clearSearchEl.hidden = !searchEl.value;

    if (updateURL) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      if (level) url.searchParams.set("level", level);
      else url.searchParams.delete("level");
      window.history.replaceState(null, "", url);
    }
  }

  function restoreQuery() {
    const params = new URL(window.location.href).searchParams;
    searchEl.value = params.get("q") || "";
    const level = params.get("level");
    if (levelEl) levelEl.value = ["beginner", "intermediate"].includes(level) ? level : "";
    filter(false);
  }

  document.documentElement.classList.add("has-js");
  document.getElementById("search-form").hidden = false;
  document.getElementById("catalog-tools").hidden = false;
  restoreQuery();
  window.addEventListener("popstate", restoreQuery);
  window.addEventListener("pageshow", restoreQuery);
  searchEl.addEventListener("input", () => filter());
  levelEl?.addEventListener("change", () => filter());
  document.getElementById("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    filter();
    document.getElementById("main-content").scrollIntoView();
  });
  searchEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchEl.value) {
      searchEl.value = "";
      filter();
    }
  });
  clearSearchEl.addEventListener("click", () => {
    searchEl.value = "";
    filter();
    searchEl.focus();
  });
})();
