import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parse } from "parse5";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const read = (file) => readFileSync(path.join(root, file), "utf8");
export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
export const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
export const hasClass = (node, name) => (attribute(node, "class") || "").split(/\s+/).includes(name);
export const text = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join("");
export const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

export function nodes(node) {
  return [node, ...(node.childNodes || []).flatMap(nodes)];
}

export function document(source) {
  return nodes(parse(source, { sourceCodeLocationInfo: true }));
}

export function loadCatalog() {
  const catalog = vm.runInNewContext(`${read("js/site-data.js")}\n; SITE_DATA;`, Object.create(null), { timeout: 1000 });
  return JSON.parse(JSON.stringify(catalog));
}

export function publishedTopics(catalog) {
  return catalog.flatMap((module) => module.topics.filter((topic) => topic.status === "published").map((topic) => ({
    ...topic,
    module,
    id: `${module.track}:${topic.slug}`,
    file: `${module.path}/${topic.slug}.html`,
  })));
}

export function catalogErrors(catalog) {
  const errors = [];
  const identities = new Set();
  const files = new Set();
  const modules = new Set();
  const published = new Set();
  for (const module of catalog) {
    if (modules.has(module.id)) errors.push(`Duplicate module: ${module.id}`);
    modules.add(module.id);
    for (const field of ["id", "track", "color"]) {
      if (!/^[a-z][a-z0-9-]*$/.test(module[field] || "")) errors.push(`Invalid module ${field}: ${module.id}`);
    }
    if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(module.path || "")) errors.push(`Invalid module path: ${module.id}`);
    for (const topic of module.topics) {
      const id = `${module.track}:${topic.slug}`;
      const file = `${module.path}/${topic.slug}.html`;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug)) errors.push(`Invalid slug: ${id}`);
      if (identities.has(id)) errors.push(`Duplicate topic: ${id}`);
      if (files.has(file)) errors.push(`Duplicate file: ${file}`);
      identities.add(id);
      files.add(file);
      if (!["published", "planned"].includes(topic.status)) errors.push(`Invalid status: ${id}`);
      if (topic.status === "published") published.add(id);
      if (!topic.title || !topic.summary) errors.push(`Missing title or summary: ${id}`);
      if (!["beginner", "intermediate"].includes(topic.level)) errors.push(`Invalid level: ${id}`);
      if (topic.aliases && (!Array.isArray(topic.aliases) || topic.aliases.some((alias) => typeof alias !== "string"))) errors.push(`Invalid aliases: ${id}`);
    }
  }
  for (const module of catalog) {
    for (const topic of module.topics) {
      const id = `${module.track}:${topic.slug}`;
      for (const reference of [...(topic.prerequisites || []), ...(topic.related || [])]) {
        if (reference === id || !published.has(reference)) errors.push(`Invalid reference: ${id} -> ${reference}`);
      }
    }
  }
  return errors;
}

export function trackHome(track) {
  return track === "networking" ? "index.html" : `${track}/index.html`;
}

export function catalogPages(catalog) {
  return [...new Set(publishedTopics(catalog).map((topic) => trackHome(topic.module.track)))];
}

export function relativeLink(from, to) {
  return path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
}

export function applyReplacements(source, replacements) {
  const newline = source.match(/\r?\n/)?.[0] || "\n";
  let previousStart = source.length;
  for (const { start, end, value } of replacements.sort((left, right) => right.start - left.start)) {
    if (end > previousStart) throw new Error("Overlapping generated regions");
    source = source.slice(0, start) + value.replace(/\r?\n/g, newline) + source.slice(end);
    previousStart = start;
  }
  return source;
}