(function () {
  const article = document.querySelector(".topic-body");
  if (!article) return;

  document.documentElement.classList.add("has-js");

  const topicHeader = document.querySelector(".topic-header");
  const headings = Array.from(article.querySelectorAll("h2, h3"));
  const mobileViewport = window.matchMedia("(max-width: 760px)");
  const existingIds = new Set(
    Array.from(document.querySelectorAll("[id]"), (element) => element.id)
  );

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function getUniqueId(baseId) {
    let id = baseId;
    let suffix = 2;

    while (existingIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    existingIds.add(id);
    return id;
  }

  function buildTopicLayout() {
    const main = document.createElement("main");
    main.id = "main-content";
    main.className = "topic-main";
    main.tabIndex = -1;

    const layout = document.createElement("div");
    layout.className = "topic-layout wrap";

    article.parentNode.insertBefore(main, article);
    main.appendChild(layout);
    article.classList.remove("wrap");
    layout.appendChild(article);

    return layout;
  }

  function buildContents() {
    const contents = document.createElement("details");
    contents.className = "topic-contents";
    contents.open = !mobileViewport.matches;

    const summary = document.createElement("summary");
    summary.textContent = "On this page";

    const navigation = document.createElement("nav");
    navigation.setAttribute("aria-label", "Page sections");
    const list = document.createElement("ol");
    const links = [];

    headings.forEach((heading) => {
      const headingText = heading.textContent.trim();
      const id = heading.id || getUniqueId(slugify(headingText));
      heading.id = id;

      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#${id}`;
      anchor.setAttribute("aria-label", `Link to ${headingText}`);
      anchor.title = "Link to this section";
      anchor.textContent = "#";
      heading.appendChild(anchor);

      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = headingText;
      if (heading.tagName === "H3") {
        link.className = "toc-subsection";
      }

      item.appendChild(link);
      list.appendChild(item);
      links.push(link);
    });

    navigation.appendChild(list);
    contents.append(summary, navigation);

    contents.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link || !mobileViewport.matches) return;

      event.preventDefault();
      contents.open = false;

      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
        window.history.pushState(null, "", link.hash);
      }
    });

    mobileViewport.addEventListener("change", (event) => {
      contents.open = !event.matches;
    });

    return { contents, links };
  }

  function wrapTables() {
    article.querySelectorAll("table.compare-table").forEach((table) => {
      if (table.parentElement.classList.contains("table-scroll")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "Scrollable comparison table");
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function startDiagramsOnEntry() {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const diagrams = Array.from(article.querySelectorAll("svg")).filter((diagram) =>
      diagram.querySelector("animate, animateMotion")
    );
    if (!diagrams.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.setCurrentTime(0);
          entry.target.unpauseAnimations();
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.25 }
    );

    diagrams.forEach((diagram) => {
      diagram.pauseAnimations();
      diagram.setCurrentTime(0);
      observer.observe(diagram);
    });
  }

  function addDiagramViewer() {
    const figures = Array.from(article.querySelectorAll("figure.diagram-block")).filter((figure) =>
      figure.querySelector("svg")?.viewBox.baseVal.width >= 600
    );
    if (!figures.length || typeof HTMLDialogElement === "undefined") return;
    const dialog = document.createElement("dialog");
    dialog.className = "diagram-viewer";
    dialog.setAttribute("aria-label", "Expanded diagram");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "diagram-close";
    close.setAttribute("aria-label", "Close diagram");
    close.title = "Close diagram";
    close.textContent = "\u00d7";
    const canvas = document.createElement("div");
    canvas.className = "diagram-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "region");
    canvas.setAttribute("aria-label", "Scrollable diagram");
    const caption = document.createElement("p");
    dialog.append(close, canvas, caption);
    document.body.appendChild(dialog);
    let restore;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      restore?.();
      restore = undefined;
    });
    figures.forEach((figure) => {
      const diagram = figure.querySelector("svg");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "diagram-expand";
      button.title = "Expand diagram";
      button.setAttribute("aria-label", "Expand diagram");
      button.textContent = "\u26f6";
      figure.prepend(button);
      button.addEventListener("click", () => {
        const next = diagram.nextSibling;
        restore = () => {
          figure.insertBefore(diagram, next);
          button.focus();
        };
        canvas.style.setProperty("--diagram-width", `${diagram.viewBox.baseVal.width}px`);
        canvas.appendChild(diagram);
        caption.textContent = figure.querySelector("figcaption")?.textContent || "";
        dialog.showModal();
        close.focus();
      });
    });
  }

  function addSkipLink() {
    if (document.querySelector(".skip-link")) return;

    const skipLink = document.createElement("a");
    skipLink.className = "skip-link";
    skipLink.href = "#main-content";
    skipLink.textContent = "Skip to article";
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  function addReadingProgress() {
    const progress = document.createElement("div");
    progress.className = "reading-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.style.setProperty(
      "--module-color",
      topicHeader ? topicHeader.style.getPropertyValue("--module-color") : "var(--l2)"
    );

    const indicator = document.createElement("span");
    progress.appendChild(indicator);
    document.body.appendChild(progress);

    return indicator;
  }

  addSkipLink();
  const layout = buildTopicLayout();
  const { contents, links } = buildContents();
  layout.insertBefore(contents, article);
  wrapTables();
  startDiagramsOnEntry();
  addDiagramViewer();

  const progressIndicator = addReadingProgress();
  const siteHeader = document.querySelector(".site-header");
  let animationFrame;

  function updateReadingState() {
    animationFrame = undefined;

    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const readerPosition = window.scrollY + window.innerHeight * 0.25;
    const progress = Math.min(
      1,
      Math.max(0, (readerPosition - articleTop) / article.offsetHeight)
    );
    progressIndicator.style.width = `${Math.round(progress * 100)}%`;

    const activationLine = (siteHeader ? siteHeader.offsetHeight : 0) + 28;
    let activeIndex = 0;

    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= activationLine) {
        activeIndex = index;
      }
    });

    links.forEach((link, index) => {
      if (index === activeIndex) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function requestReadingStateUpdate() {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(updateReadingState);
    }
  }

  window.addEventListener("scroll", requestReadingStateUpdate, { passive: true });
  window.addEventListener("resize", requestReadingStateUpdate);
  requestReadingStateUpdate();
})();
