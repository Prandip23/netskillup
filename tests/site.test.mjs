import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadCatalog, catalogErrors, publishedTopics, read, document, attribute, text, relativeLink } from "../scripts/site-lib.mjs";
import { syncHTML, renderCatalog } from "../scripts/sync-site.mjs";

const mainSource = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");

function searchFixture() {
  const elements = new Map();
  for (const id of ["module-list", "topic-search", "clear-search", "search-results", "no-results", "topic-level", "catalog-tools", "search-form"]) {
    elements.set(id, {
      value: "",
      handlers: {},
      appendChild() {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      focus() { this.focused = true; },
    });
  }
  const rows = [
    { dataset: { topic: "arp address resolution protocol", search: "arp address resolution protocol 02 l2 layer 2", level: "beginner" } },
    { dataset: { topic: "ipv4 subnetting, cidr and vlsm", search: "ipv4 subnetting, cidr and vlsm 03 l3 layer 3", level: "intermediate" } },
  ].map((row) => ({ ...row, closest() { return this; } }));
  const modules = rows.map((row) => ({ querySelectorAll: () => [row], querySelector: () => ({ appendChild() {} }) }));
  const document = {
    getElementById: (id) => elements.get(id),
    documentElement: { classList: { add() {} } },
    querySelector: () => null,
    querySelectorAll: () => modules,
  };
  const window = { location: { href: "https://example.test/repo/index.html" }, history: { replaceState(_state, _title, url) { window.location.href = String(url); } }, addEventListener() {} };
  vm.runInNewContext(mainSource, { document, window, URL });
  const input = elements.get("topic-search");
  return {
    rows,
    elements,
    input,
    window,
    query(value) {
      input.value = value;
      input.handlers.input({ target: input });
      return rows.filter((row) => !row.hidden);
    },
  };
}

test("search combines module and title terms, ignoring case and extra whitespace", () => {
  const fixture = searchFixture();
  assert.deepEqual(fixture.query("  L2  ARP "), [fixture.rows[0]]);
  assert.deepEqual(fixture.query("layer 3 subnetting"), [fixture.rows[1]]);
  assert.equal(fixture.query("").length, 2);
  assert.equal(fixture.query("missing").length, 0);
  assert.equal(fixture.elements.get("no-results").hidden, false);
});

test("Escape and clear restore all topics; clear returns focus to search", () => {
  const fixture = searchFixture();
  fixture.query("ARP");
  fixture.input.handlers.keydown({ key: "Escape" });
  assert.equal(fixture.input.value, "");
  assert.ok(fixture.rows.every((row) => !row.hidden));
  fixture.query("missing");
  fixture.elements.get("clear-search").handlers.click();
  assert.equal(fixture.input.value, "");
  assert.equal(fixture.input.focused, true);
  assert.ok(fixture.rows.every((row) => !row.hidden));
});

test("classic-script adapter loads all published topics and valid references", () => {
  const catalog = loadCatalog();
  assert.equal(publishedTopics(catalog).length, 53);
  assert.equal(catalog.length, 9);
  for (const module of catalog) assert.ok(read("css/style.css").includes(`--${module.color}:`), module.id);
  assert.deepEqual(catalogErrors(catalog), []);
  catalog[0].topics[0].related = ["networking:missing"];
  assert.match(catalogErrors(catalog).join("\n"), /Invalid reference/);
});

test("sync is idempotent on every page and leaves SVG content unchanged", () => {
  const catalog = loadCatalog();
  for (const file of ["index.html", ...publishedTopics(catalog).map((topic) => topic.file)]) {
    const source = read(file);
    const output = syncHTML(source, file, catalog, "https://netskillup.com");
    assert.equal(syncHTML(output, file, catalog, "https://netskillup.com"), output, file);
    const diagrams = (html) => document(html).filter((node) => node.tagName === "svg").map((node) => html.slice(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset));
    assert.deepEqual(diagrams(output), diagrams(source), file);
  }
});

test("static catalog includes published topics only and encodes metadata safely", () => {
  const catalog = loadCatalog();
  catalog[0].topics[0].summary = '<sample & "quoted">';
  catalog[0].topics[1].status = "planned";
  const html = renderCatalog(catalog);
  assert.match(html, /&lt;sample &amp; &quot;quoted&quot;&gt;/);
  assert.ok(!html.includes('href="topics/network-topologies.html"'));
  assert.equal(document(html).filter((node) => attribute(node, "class") === "topic-row").length, 52);
  assert.equal(relativeLink("topics/arp.html", "index.html"), "../index.html");
});

test("worked VLSM table has aligned, nonoverlapping ranges with sufficient capacity", () => {
  const allNodes = document(read("topics/ipv4-subnetting-cidr-vlsm.html"));
  const table = allNodes.find((node) => attribute(node, "id") === "vlsm-allocation");
  assert.ok(table);
  const rows = table.childNodes.find((node) => node.tagName === "tbody").childNodes.filter((node) => node.tagName === "tr");
  let end = 0;
  for (const row of rows) {
    const cells = row.childNodes.filter((node) => node.tagName === "td").map(text);
    const [address, prefix] = cells[1].split("/");
    const start = Number(address.split(".").at(-1));
    const size = 2 ** (32 - Number(prefix));
    assert.equal(start % size, 0);
    assert.ok(start >= end);
    assert.ok(size - 2 >= Number.parseInt(cells[0], 10));
    assert.equal(Number(cells[4]), size - 2);
    assert.equal(cells[2], `10.0.1.${start + 1} to 10.0.1.${start + size - 2}`);
    assert.equal(cells[3], `10.0.1.${start + size - 1}`);
    end = start + size;
  }
  assert.equal(256 - end, 156);
});

test("aliases and level filter combine and query state stays under a project subpath", () => {
  const fixture = searchFixture();
  assert.deepEqual(fixture.query("address resolution"), [fixture.rows[0]]);
  assert.match(fixture.window.location.href, /\/repo\/index.html\?q=address\+resolution/);
  fixture.elements.get("topic-level").value = "intermediate";
  fixture.elements.get("topic-level").handlers.change();
  assert.ok(fixture.rows.every((row) => row.hidden));
  assert.match(fixture.window.location.href, /level=intermediate/);
  fixture.query("");
  assert.equal(fixture.rows[1].hidden, false);
  assert.equal(fixture.rows[0].hidden, true);
});

test("sync preserves Windows newlines and remains fresh after an editor save", () => {
  const catalog = loadCatalog();
  const source = read("index.html").replace(/\r?\n/g, "\r\n");
  const output = syncHTML(source, "index.html", catalog, "https://netskillup.com");
  assert.ok(!/(?<!\r)\n/.test(output));
  assert.equal(syncHTML(output, "index.html", catalog, "https://netskillup.com"), output);
});

test("performance example converts bytes to bits and calculates transfer time", () => {
  const allNodes = document(read("topics/bandwidth-throughput-latency.html"));
  const table = allNodes.find((node) => attribute(node, "id") === "transfer-calculation");
  const row = table.childNodes.find((node) => node.tagName === "tbody").childNodes.find((node) => node.tagName === "tr");
  const [megabytes, goodput, megabits, seconds] = row.childNodes.filter((node) => node.tagName === "td").map((node) => Number(text(node)));
  assert.equal(megabytes * 8, megabits);
  assert.equal(megabits / goodput, seconds);
  assert.equal(allNodes.filter((node) => node.tagName === "h1").length, 1);
  assert.ok(allNodes.some((node) => node.tagName === "svg" && attribute(node, "aria-label")));
});

test("PoE example reserves power at the PSE and stays within its budget", () => {
  const allNodes = document(read("topics/copper-fiber-transceivers-poe.html"));
  const table = allNodes.find((node) => attribute(node, "id") === "poe-allocation");
  const row = table.childNodes.find((node) => node.tagName === "tbody").childNodes.find((node) => node.tagName === "tr");
  const [count, watts, reserved, budget, remaining] = row.childNodes.filter((node) => node.tagName === "td").map((node) => Number(text(node)));
  assert.equal(count * watts, reserved);
  assert.equal(budget - reserved, remaining);
  assert.ok(remaining >= 0);
});

test("expansion articles have reference sections, unique anchors, and accessible diagrams", () => {
  for (const slug of ["bandwidth-throughput-latency", "copper-fiber-transceivers-poe", "wifi-bands-channels-airtime", "wifi-association-security-roaming", "network-troubleshooting-tools", "packet-capture-wireshark-tcpdump", "campus-design-segmentation", "gateway-redundancy-vrrp-hsrp"]) {
    const source = read(`topics/${slug}.html`);
    const allNodes = document(source);
    const ids = allNodes.map((node) => attribute(node, "id")).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, slug);
    assert.equal(allNodes.filter((node) => node.tagName === "h1").length, 1, slug);
    for (const id of ["related-topics", "sources"]) assert.ok(ids.includes(id), `${slug}: ${id}`);
    for (const className of ["topic-answer", "topic-prerequisites", "callout"]) {
      assert.ok(allNodes.some((node) => (attribute(node, "class") || "").split(/\s+/).includes(className)), `${slug}: ${className}`);
    }
    const diagrams = allNodes.filter((node) => node.tagName === "svg");
    assert.ok(diagrams.length, slug);
    assert.ok(diagrams.every((node) => attribute(node, "role") === "img" && attribute(node, "aria-label")), slug);
    for (const rectangle of allNodes.filter((node) => node.tagName === "rect")) {
      for (const dimension of ["width", "height"]) assert.ok(Number(attribute(rectangle, dimension)) > 0, `${slug}: SVG ${dimension}`);
    }
    assert.ok(!source.includes("\u2014"), slug);
  }
});

test("synthetic TCP trace repeats the SYN and acknowledges its sequence space", () => {
  const diagramNodes = document(read("topics/packet-capture-wireshark-tcpdump.html"));
  const exchanges = diagramNodes.find((node) => node.tagName === "g" && attribute(node, "marker-end") === "url(#capture-arrow)");
  assert.equal(exchanges.childNodes.filter((node) => node.tagName === "path").length, 4);
  const table = document(read("topics/packet-capture-wireshark-tcpdump.html")).find((node) => attribute(node, "id") === "synthetic-handshake");
  const rows = table.childNodes.find((node) => node.tagName === "tbody").childNodes.filter((node) => node.tagName === "tr")
    .map((row) => row.childNodes.filter((node) => node.tagName === "td").map(text));
  assert.equal(rows.length, 4);
  assert.equal(rows[0][3], rows[1][3]);
  assert.equal(Number(rows[2][4]), Number(rows[0][3]) + 1);
  assert.equal(Number(rows[3][4]), Number(rows[2][3]) + 1);
  assert.equal(Number(rows[3][3]), Number(rows[0][3]) + 1);
  assert.ok(rows.every((row, index) => index === 0 || Number(row[0]) > Number(rows[index - 1][0])));
});

test("VRRP timer example includes the backup priority skew", () => {
  const table = document(read("topics/gateway-redundancy-vrrp-hsrp.html")).find((node) => attribute(node, "id") === "vrrp-timer");
  const row = table.childNodes.find((node) => node.tagName === "tbody").childNodes.find((node) => node.tagName === "tr");
  const [priority, interval, skew, activeDown] = row.childNodes.filter((node) => node.tagName === "td").map((node) => Number(text(node)));
  assert.equal((256 - priority) / 256 * interval, skew);
  assert.equal(3 * interval + skew, activeDown);
});