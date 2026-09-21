import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { root, loadCatalog, publishedTopics } from "../scripts/site-lib.mjs";

const topics = publishedTopics(loadCatalog());
const topicCount = topics.filter((topic) => topic.module.track === "networking").length;
const aiPages = topics.filter((topic) => topic.module.track === "ai").map((topic) => topic.file);
const expansionPages = [
  "topics/copper-fiber-transceivers-poe.html",
  "topics/bandwidth-throughput-latency.html",
  "topics/wifi-bands-channels-airtime.html",
  "topics/wifi-association-security-roaming.html",
  "topics/campus-design-segmentation.html",
  "topics/gateway-redundancy-vrrp-hsrp.html",
  "topics/network-troubleshooting-tools.html",
  "topics/packet-capture-wireshark-tcpdump.html",
];

test("reference browser workflows", async (suite) => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const relative = decodeURIComponent(url.pathname).replace(/^\/preview\//, "").replace(/^\//, "") || "index.html";
      const file = path.resolve(root, relative);
      if (!file.startsWith(root)) throw new Error("Invalid path");
      const content = await readFile(file);
      response.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" })[path.extname(file)] || "text/plain");
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/preview/`;
  const browser = await chromium.launch();
  await mkdir(path.join(root, "test-results"), { recursive: true });
  try {
    await suite.test("search, filters, article entry, back navigation, keyboard clear", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base);
      await page.locator("#topic-search").fill("L2 ARP");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      await page.locator(".topic-row:visible").click();
      await page.waitForURL("**/topics/arp.html");
      await page.goBack();
      assert.equal(await page.locator("#topic-search").inputValue(), "L2 ARP");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      await page.locator("#topic-search").press("Escape");
      assert.equal(await page.locator(".topic-row:visible").count(), topicCount);
      await page.locator("#topic-search").fill("layer 3 subnetting");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      await page.locator("#topic-level").selectOption("intermediate");
      assert.equal(await page.locator(".topic-row:visible").count(), 0);
      await page.locator("#topic-level").selectOption("");
      await page.locator("#clear-search").click();
      assert.equal(await page.locator("#topic-search").evaluate((node) => node === document.activeElement), true);
      await page.goto(`${base}topics/arp.html`);
      await page.locator("#reference-search input").fill("source NAT");
      await page.locator("#reference-search input").press("Enter");
      await page.waitForURL("**/index.html?q=source+NAT");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      for (const [query, file] of [
        ["FUND PoE", expansionPages[0]],
        ["WLAN airtime", expansionPages[2]],
        ["wireless SAE", expansionPages[3]],
        ["ENT FHRP", expansionPages[5]],
        ["OPS pcap", expansionPages[7]],
      ]) {
        await page.locator("#topic-search").fill(query);
        assert.equal(await page.locator(".topic-row:visible").count(), 1, query);
        assert.equal(await page.locator(".topic-row:visible").getAttribute("href"), file, query);
      }
      assert.deepEqual(errors, []);
      await page.close();
    });

    await suite.test("complete catalog and section links work without JavaScript", async () => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(base);
      assert.equal(await page.locator(".topic-row:visible").count(), topicCount);
      assert.equal(await page.locator("#module-jump a").count(), 9);
      assert.equal(await page.locator("#search-form").isVisible(), false);
      await page.locator('a[href="topics/ipv4-subnetting-cidr-vlsm.html"]').click();
      assert.equal(await page.locator("#worked-allocation").count(), 1);
      assert.equal(await page.locator(".topic-nav a").count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.getByRole("navigation", { name: "Reference tracks" }).getByRole("link", { name: "AI & LLMs" }).click();
      assert.equal(await page.locator(".topic-row:visible").count(), 5);
      assert.equal(await page.locator("#module-jump a").count(), 3);
      await page.locator('.topic-row').first().click();
      assert.equal(await page.locator("h1").textContent(), "AI & LLM Foundations");
      for (const file of [...expansionPages, ...aiPages]) {
        await page.goto(`${base}${file}`);
        assert.equal(await page.locator("h1").count(), 1, file);
        assert.equal(await page.locator("#sources").count(), 1, file);
        assert.equal(await page.locator(".topic-nav a").count(), 2, file);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), file);
      }
      await context.close();
    });

    await suite.test("responsive layouts, accessibility, diagrams, and print", async () => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && message.location().url.startsWith(base)) errors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      const pages = [
        "index.html",
        "topics/hubs-switches-routers.html",
        "topics/arp.html",
        "topics/ipv4-subnetting-cidr-vlsm.html",
        "topics/flow-congestion-control.html",
        "topics/dns-resolution-flow.html",
        "topics/http-https-versions.html",
        "topics/tls-handshake.html",
        ...expansionPages,
        "ai/index.html",
        ...aiPages,
      ];
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const file of pages) {
          await page.goto(`${base}${file}`);
          await page.locator(".wire-detail").evaluateAll((details) => details.forEach((detail) => { detail.open = true; }));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: ${file} overflow`);
          assert.ok(await page.locator(".diagram-block figcaption").evaluateAll((captions) => captions.every((caption) => {
            const bounds = caption.getBoundingClientRect();
            const figure = caption.parentElement.getBoundingClientRect();
            return bounds.left >= figure.left && bounds.right <= figure.right;
          })), `${width}: ${file} clipped caption`);
          assert.ok(await page.locator(".diagram-block:has(.diagram-expand)").evaluateAll((figures) => figures.every((figure) => {
            const diagram = figure.querySelector("svg").getBoundingClientRect();
            return diagram.width <= figure.clientWidth;
          })), `${width}: ${file} clipped diagram overview`);
          assert.equal(await page.locator("h1").count(), 1);
          if (file === "ai/index.html") {
            assert.ok(await page.locator(".ai-hero .hero-art").evaluate((diagram) => {
              const bounds = diagram.getBoundingClientRect();
              const copy = document.querySelector(".ai-hero .hero-copy").getBoundingClientRect();
              return bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth && (bounds.left >= copy.right || bounds.top >= copy.bottom);
            }), `${width}: AI hero overlaps or clips`);
            assert.ok(await page.locator(".ai-hero animate, .ai-hero animateMotion").evaluateAll((animations) => animations.every((animation) => animation.getAttribute("dur") === "999999s")), "AI hero respects reduced motion");
          }
          assert.ok(await page.locator(".site-header .wrap").evaluate((header) => {
            const children = [...header.children].filter((node) => node.getBoundingClientRect().width > 0);
            return children.every((node, index) => children.slice(index + 1).every((other) => {
              const first = node.getBoundingClientRect(), second = other.getBoundingClientRect();
              return first.right <= second.left + 1 || second.right <= first.left + 1 || first.bottom <= second.top + 1 || second.bottom <= first.top + 1;
            }));
          }), `${width}: ${file} overlapping header`);
          if (file.endsWith("index.html")) {
            assert.ok(await page.locator(".ai-catalog .topic-list").evaluateAll((lists) => lists.every((list) => {
              const last = list.lastElementChild.getBoundingClientRect();
              return list.getBoundingClientRect().bottom - last.bottom <= 2;
            })), `${width}: AI list has stretched empty space`);
            assert.ok(await page.locator(".topic-list").evaluateAll((lists) => lists.every((list) => list.scrollWidth <= list.clientWidth + 1)), `${width}: catalog list clipped internally`);
            assert.ok(await page.locator(".topic-info").evaluateAll((items) => items.every((item) => {
              const bounds = item.getBoundingClientRect();
              const row = item.closest(".topic-row").getBoundingClientRect();
              return bounds.left >= row.left && bounds.right <= row.right && item.scrollWidth <= item.clientWidth + 1;
            })), `${width}: catalog text clipped internally`);
          }
          if ([...expansionPages, ...aiPages].includes(file)) {
            assert.ok(await page.locator("figure svg text").evaluateAll((labels) => labels.every((label) => {
              const bounds = label.getBBox();
              const canvas = label.ownerSVGElement.viewBox.baseVal;
              return bounds.x >= canvas.x && bounds.y >= canvas.y && bounds.x + bounds.width <= canvas.x + canvas.width && bounds.y + bounds.height <= canvas.y + canvas.height;
            })), `${width}: ${file} SVG label outside canvas`);
          }
          if ([390, 1280].includes(width)) {
            const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            assert.deepEqual(result.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(", ")}`), [], `${width}: ${file}`);
          }
          const screenshotName = file === "ai/index.html" ? "ai-index" : path.basename(file, ".html");
          if ([390, 1280].includes(width)) await page.screenshot({ path: path.join(root, "test-results", `${screenshotName}-${width}.png`), fullPage: true });
          if ([390, 1280].includes(width) && [...expansionPages, ...aiPages].includes(file)) {
            await page.screenshot({ path: path.join(root, "test-results", `${path.basename(file, ".html")}-header-${width}.png`) });
            await page.locator("figure").first().screenshot({ path: path.join(root, "test-results", `${path.basename(file, ".html")}-diagram-${width}.png`) });
          }
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}topics/ipv4-subnetting-cidr-vlsm.html#worked-allocation`);
      await page.locator(".topic-contents summary").click();
      await page.locator('.topic-contents a[href="#check-a-host"]').click();
      assert.equal(await page.locator("#check-a-host").evaluate((node) => node === document.activeElement), true);
      assert.equal(await page.locator(".topic-contents").getAttribute("open"), null);
      const expand = page.getByRole("button", { name: "Expand diagram", exact: true }).first();
      await expand.click();
      assert.equal(await page.getByRole("dialog").isVisible(), true);
      assert.equal(await page.locator(".diagram-canvas svg").count(), 1);
      assert.ok(await page.locator(".diagram-canvas").evaluate((node) => node.scrollWidth > node.clientWidth));
      await page.locator(".diagram-canvas").focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector(".diagram-canvas").scrollLeft > 0);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("dialog").open);
      await page.locator("figure svg").waitFor({ state: "attached" });
      assert.equal(await expand.evaluate((node) => node === document.activeElement), true);
      assert.equal(await page.locator("figure svg").count(), 1);
      await page.setViewportSize({ width: 1280, height: 450 });
      await page.goto(`${base}topics/ipv4-subnetting-cidr-vlsm.html`);
      assert.ok(await page.locator(".topic-contents").evaluate((node) => node.getBoundingClientRect().height <= innerHeight - 100));
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator(".topic-contents").isVisible(), false);
      await page.pdf({ path: path.join(root, "test-results", "subnetting.pdf"), printBackground: true });
      assert.deepEqual(errors, []);
      await page.close();
    });

    await suite.test("AI search, history, track navigation, and reading order", async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${base}ai/index.html`);
      await page.getByRole("link", { name: "Browse the curriculum", exact: true }).click();
      assert.ok(page.url().endsWith("ai/index.html#modules"));
      await page.getByRole("link", { name: "Start reading", exact: false }).click();
      await page.waitForURL("**/ai/topics/ai-llm-foundations.html");
      await page.goBack();
      assert.equal(await page.locator(".topic-row:visible").count(), 5);
      for (const [query, slug] of [["LOCAL VRAM", "local-ai-hardware"], ["Ollama Windows", "run-first-local-model"], ["BM25", "rag-explained"], ["tokenizer", "tokens-context-prompting"]]) {
        await page.locator("#topic-search").fill(query);
        assert.equal(await page.locator(".topic-row:visible").count(), 1, query);
        assert.equal(await page.locator(".topic-row:visible").getAttribute("href"), `topics/${slug}.html`);
      }
      await page.locator(".topic-row:visible").click();
      await page.goBack();
      assert.equal(await page.locator("#topic-search").inputValue(), "tokenizer");
      await page.locator("#topic-search").press("Escape");
      await page.locator("#topic-level").selectOption("intermediate");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      await page.locator(".topic-row:visible").click();
      assert.equal(await page.locator(".topic-nav a").last().getAttribute("href"), "../index.html");
      await page.locator("#reference-search input").fill("Qwen");
      await page.locator("#reference-search input").press("Enter");
      await page.waitForURL("**/ai/index.html?q=Qwen");
      assert.equal(await page.locator(".topic-row:visible").count(), 1);
      await page.getByRole("navigation", { name: "Reference tracks" }).getByRole("link", { name: "Networking", exact: true }).click();
      assert.equal(await page.locator(".topic-row:visible").count(), 53);
      await page.getByRole("navigation", { name: "Reference tracks" }).getByRole("link", { name: "AI & LLMs" }).click();
      await page.locator(".topic-row").first().click();
      for (const file of aiPages) {
        assert.ok(page.url().endsWith(file));
        await page.locator(".topic-nav a").last().click();
      }
      assert.ok(page.url().endsWith("ai/index.html"));
      await page.close();
    });

    await suite.test("AI hero motion and article animation on viewport entry", async () => {
      const context = await browser.newContext({ reducedMotion: "no-preference" });
      const page = await context.newPage();
      try {
        await page.goto(`${base}ai/index.html`);
        const initialPosition = await page.locator(".ai-hero svg > rect").first().evaluate((token) => {
          const matrix = token.getCTM();
          return { x: matrix.e, y: matrix.f };
        });
        await page.waitForFunction((initial) => {
          const matrix = document.querySelector(".ai-hero svg > rect").getCTM();
          return Math.hypot(matrix.e - initial.x, matrix.f - initial.y) > 5;
        }, initialPosition);
        await page.goto(`${base}topics/arp.html`);
        await page.locator("figure svg").scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const diagram = document.querySelector("figure svg");
          return !diagram.animationsPaused() && diagram.getCurrentTime() > 0.1;
        });
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});