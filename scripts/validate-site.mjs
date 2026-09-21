import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root, read, document, attribute, loadCatalog, publishedTopics, catalogErrors, catalogPages } from "./site-lib.mjs";

export function validateSite() {
  const catalog = loadCatalog();
  const errors = catalogErrors(catalog);
  const topics = publishedTopics(catalog);
  const files = [...catalogPages(catalog), ...topics.map((topic) => topic.file)];
  const documents = new Map();
  const idsByFile = new Map();
  for (const file of files) {
    if (!existsSync(path.join(root, file))) { errors.push(`Missing published file: ${file}`); continue; }
    const source = read(file);
    const allNodes = document(source);
    documents.set(file, allNodes);
    const ids = new Set();
    for (const node of allNodes) {
      const id = attribute(node, "id");
      if (!id) continue;
      if (ids.has(id)) errors.push(`${file}: duplicate ID ${id}`);
      ids.add(id);
    }
    idsByFile.set(file, ids);
    if (source.includes("\u2014")) errors.push(`${file}: em dash violates writing conventions`);
    if (allNodes.filter((node) => node.tagName === "h1").length !== 1) errors.push(`${file}: expected one h1`);
  }
  for (const [file, allNodes] of documents) {
    for (const node of allNodes) {
      for (const name of ["href", "src"]) {
        const value = attribute(node, name);
        if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;
        if (value.startsWith("/")) { errors.push(`${file}: root-relative link breaks project subpaths: ${value}`); continue; }
        const url = new URL(value, `https://local.invalid/${file}`);
        const target = decodeURIComponent(url.pathname.slice(1)) || "index.html";
        if (!existsSync(path.join(root, target))) { errors.push(`${file}: missing local target ${value}`); continue; }
        if (url.hash && idsByFile.has(target) && !idsByFile.get(target).has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${file}: missing fragment ${value}`);
      }
    }
  }
  for (const folder of new Set(catalog.map((module) => module.path))) {
    for (const file of readdirSync(path.join(root, folder))) {
      if (file.endsWith(".html") && !topics.some((topic) => topic.file === `${folder}/${file}`)) errors.push(`Unlisted article: ${folder}/${file}`);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const errors = validateSite();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Catalog, published files, IDs, references, and local links are valid.");
  }
}