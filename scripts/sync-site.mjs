import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  root, read, escapeHTML, attribute, hasClass, text, document, slugify,
  loadCatalog, publishedTopics, catalogErrors, relativeLink, applyReplacements, trackHome, catalogPages,
} from "./site-lib.mjs";

export function renderCatalog(catalog, track = "networking", file = "index.html") {
  return catalog.filter((module) => module.track === track).map((module) => {
    const topics = module.topics.filter((topic) => topic.status === "published");
    if (!topics.length) return "";
    const headingId = `module-${module.id}-heading`;
    const rows = topics.map((topic, index) => {
      const primary = `${topic.title} ${(topic.aliases || []).join(" ")}`;
      const search = `${primary} ${topic.summary} ${module.number} ${module.tag} ${module.title}`;
      return `<li><a class="topic-row" href="${relativeLink(file, `${module.path}/${topic.slug}.html`)}" data-topic="${escapeHTML(primary.toLowerCase())}" data-search="${escapeHTML(search.toLowerCase())}" data-level="${topic.level}"><span class="topic-order">${String(index + 1).padStart(2, "0")}</span><span class="topic-info"><span class="t-title">${escapeHTML(topic.title)}</span><span class="topic-summary">${escapeHTML(topic.summary)}</span><span class="topic-level">${topic.level === "beginner" ? "Beginner" : "Intermediate"}</span></span><span class="topic-tail" aria-hidden="true">&#8594;</span></a></li>`;
    }).join("\n");
    return `<section class="module" id="module-${module.id}" data-module-id="${module.id}" style="--module-color: var(--${module.color});" aria-labelledby="${headingId}">
<div class="module-head"><p class="module-label">MODULE ${module.number}</p><h2 id="${headingId}">${escapeHTML(module.title)}</h2><p>${escapeHTML(module.blurb)}</p><span class="module-count">${topics.length} ${topics.length === 1 ? "topic" : "topics"}</span></div>
<ul class="topic-list">${rows}</ul>
</section>`;
  }).join("\n");
}

export function syncHTML(source, file, catalog, origin) {
  const allNodes = document(source);
  const replacements = [];
  const replace = (node, value, inner = false) => {
    if (!node?.sourceCodeLocation) throw new Error(`${file}: missing generated element`);
    const location = node.sourceCodeLocation;
    replacements.push({ start: inner ? location.startTag.endOffset : location.startOffset, end: inner ? location.endTag.startOffset : location.endOffset, value });
  };
  const byId = (id) => allNodes.find((node) => attribute(node, "id") === id);
  const title = text(allNodes.find((node) => node.tagName === "title"));
  const description = attribute(allNodes.find((node) => attribute(node, "name") === "description"), "content");
  if (!title || !description) throw new Error(`${file}: title and description are required`);
  const topics = publishedTopics(catalog);
  const tracks = [...new Set(topics.map((topic) => topic.module.track))];
  const catalogTrack = tracks.find((track) => trackHome(track) === file);
  const activeTrack = catalogTrack || topics.find((topic) => topic.file === file)?.module.track;
  const trackLabel = (track) => ({ networking: "Networking", ai: "AI & LLMs" }[track] || track);
  const canonical = new URL(catalogTrack ? file.replace(/index\.html$/, "") || "./" : file, `${origin}/`).href;
  const metadata = `<!-- site:metadata:start -->
<link rel="canonical" href="${escapeHTML(canonical)}">
<meta property="og:type" content="${catalogTrack ? "website" : "article"}">
<meta property="og:site_name" content="netskillup">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${escapeHTML(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHTML(title)}">
<meta name="twitter:description" content="${escapeHTML(description)}">
<!-- site:metadata:end -->`;
  const metadataStart = allNodes.find((node) => node.nodeName === "#comment" && node.data.trim() === "site:metadata:start");
  const metadataEnd = allNodes.find((node) => node.nodeName === "#comment" && node.data.trim() === "site:metadata:end");
  if (metadataStart && metadataEnd) {
    replacements.push({ start: metadataStart.sourceCodeLocation.startOffset, end: metadataEnd.sourceCodeLocation.endOffset, value: metadata });
  } else if (metadataStart || metadataEnd) {
    throw new Error(`${file}: incomplete metadata markers`);
  } else {
    const head = allNodes.find((node) => node.tagName === "head");
    const offset = head.sourceCodeLocation.endTag.startOffset;
    replacements.push({ start: offset, end: offset, value: `${metadata}\n` });
  }

  if (tracks.length > 1) {
    const navigation = `<nav class="track-nav" aria-label="Reference tracks">${tracks.map((track) => `<a href="${relativeLink(file, trackHome(track))}"${track === activeTrack ? ' aria-current="true"' : ""}>${escapeHTML(trackLabel(track))}</a>`).join("")}</nav>`;
    const existing = allNodes.find((node) => hasClass(node, "track-nav"));
    if (existing) replace(existing, navigation);
    else {
      const mark = allNodes.find((node) => hasClass(node, "site-mark"));
      const offset = mark.sourceCodeLocation.endOffset;
      replacements.push({ start: offset, end: offset, value: `\n${navigation}` });
    }
  }
  if (catalogTrack) {
    const modules = catalog.filter((module) => module.track === catalogTrack && module.topics.some((topic) => topic.status === "published"));
    const count = topics.filter((topic) => topic.module.track === catalogTrack).length;
    replace(byId("module-list"), `\n${renderCatalog(catalog, catalogTrack, file)}\n`, true);
    replace(byId("module-jump"), modules.map((module) => `<a href="#module-${module.id}" style="--module-color: var(--${module.color});"><span class="module-jump-number">${module.number}</span><span>${escapeHTML(module.title)}</span></a>`).join("\n"), true);
    const scope = catalogTrack === "networking" ? "from Ethernet frames to encrypted tunnels" : "from model foundations to grounded answers";
    const summary = `${count} ${count === 1 ? "topic" : "topics"} across ${modules.length} ${modules.length === 1 ? "module" : "modules"}`;
    replace(byId("curriculum-summary"), `${summary}, ${scope}.`, true);
    replace(byId("search-results"), `${summary}.`, true);
  } else {
    const topic = topics.find((item) => item.file === file);
    const trackTopics = topics.filter((item) => item.module.track === topic.module.track);
    const index = trackTopics.findIndex((item) => item.id === topic.id);
    const home = trackHome(topic.module.track);
    const searchLabel = topic.module.track === "networking" ? "networking" : trackLabel(topic.module.track);
    const topicSearch = `<form class="search-box" id="reference-search" role="search" action="${relativeLink(file, home)}" method="get"><input type="search" name="q" placeholder="Search topics" aria-label="Search ${escapeHTML(searchLabel)} topics"><button class="search-submit" type="submit" aria-label="Search" title="Search">&#8594;</button></form>`;
    const existingSearch = byId("reference-search");
    if (existingSearch) replace(existingSearch, topicSearch);
    else {
      const mark = allNodes.find((node) => hasClass(node, "site-mark"));
      const offset = mark.parentNode.sourceCodeLocation.endTag.startOffset;
      replacements.push({ start: offset, end: offset, value: `\n    ${topicSearch}` });
    }
    replace(allNodes.find((node) => hasClass(node, "breadcrumb")), `<a class="breadcrumb" href="${relativeLink(file, home)}#module-${topic.module.id}">&#8592; Module ${topic.module.number} &middot; ${escapeHTML(topic.module.title)}</a>`);
    const navigation = (neighbor, label) => `<a href="${relativeLink(file, neighbor?.file || home)}"><span class="nav-label">${label}</span>${escapeHTML(neighbor?.title || "All topics")}</a>`;
    replace(allNodes.find((node) => hasClass(node, "topic-nav")), `<nav class="topic-nav wrap" aria-label="Adjacent topics">\n${navigation(trackTopics[index - 1], "&#8592; PREVIOUS")}\n${navigation(trackTopics[index + 1], "NEXT &#8594;")}\n</nav>`);
    const ids = new Set(allNodes.map((node) => attribute(node, "id")).filter(Boolean));
    for (const heading of allNodes.filter((node) => ["h2", "h3"].includes(node.tagName) && !attribute(node, "id"))) {
      const base = slugify(text(heading));
      let id = base;
      let suffix = 2;
      while (ids.has(id)) id = `${base}-${suffix++}`;
      ids.add(id);
      const offset = heading.sourceCodeLocation.startTag.endOffset - 1;
      replacements.push({ start: offset, end: offset, value: ` id="${id}"` });
    }
  }
  return applyReplacements(source, replacements);
}

export function syncSite(check = false) {
  const catalog = loadCatalog();
  const errors = catalogErrors(catalog);
  if (errors.length) throw new Error(errors.join("\n"));
  const host = read("CNAME").trim();
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error("CNAME must contain a hostname");
  const origin = `https://${host}`;
  const pages = [...catalogPages(catalog), ...publishedTopics(catalog).map((topic) => topic.file)];
  const outputs = new Map(pages.map((file) => [file, syncHTML(read(file), file, catalog, origin)]));
  outputs.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((file) => `  <url><loc>${escapeHTML(new URL(file.endsWith("index.html") ? file.replace(/index\.html$/, "") || "./" : file, `${origin}/`).href)}</loc></url>`).join("\n")}\n</urlset>\n`);
  outputs.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  const changed = [];
  for (const [file, content] of outputs) {
    if (existsSync(path.join(root, file)) && read(file) === content) continue;
    changed.push(file);
    if (!check) writeFileSync(path.join(root, file), content);
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const check = process.argv.includes("--check");
  const changed = syncSite(check);
  console.log(changed.length ? `${check ? "Out of date" : "Updated"}: ${changed.join(", ")}` : "Generated site is up to date.");
  if (check && changed.length) process.exitCode = 1;
}