import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { root } from "../scripts/site-lib.mjs";

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
      assert.equal(await page.locator(".topic-row:visible").count(), 45);
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
      assert.deepEqual(errors, []);
      await page.close();
    });

    await suite.test("complete catalog and section links work without JavaScript", async () => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(base);
      assert.equal(await page.locator(".topic-row:visible").count(), 45);
      assert.equal(await page.locator("#search-form").isVisible(), false);
      await page.locator('a[href="topics/ipv4-subnetting-cidr-vlsm.html"]').click();
      assert.equal(await page.locator("#worked-allocation").count(), 1);
      assert.equal(await page.locator(".topic-nav a").count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await context.close();
    });

    await suite.test("responsive layouts, accessibility, diagrams, and print", async () => {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
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
          if ([390, 1280].includes(width)) {
            const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            assert.deepEqual(result.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(", ")}`), [], `${width}: ${file}`);
          }
          if ([390, 1280].includes(width)) await page.screenshot({ path: path.join(root, "test-results", `${path.basename(file, ".html")}-${width}.png`), fullPage: true });
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

    await suite.test("animated diagrams start on viewport entry", async () => {
      const context = await browser.newContext({ reducedMotion: "no-preference" });
      const page = await context.newPage();
      try {
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