#!/usr/bin/env node
/** 批量截取各看板页面缩略图 → assets/png/ */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'assets', 'png');
const PORT = 8777;

const PAGES = [
  { file: '01_l1_cockpit.png', url: '/l1-cockpit.html', wait: 2200 },
  { file: '02_revenue.png', url: '/revenue.html', wait: 2200 },
  { file: '03_cost.png', url: '/cost.html', wait: 2200 },
  { file: '04_profit.png', url: '/profit.html', wait: 2000 },
  { file: '05_dupont_site.png', url: '/dupont-site.html', wait: 2500 },
  { file: '06_dupont_tree.png', url: '/dupont-tree.html', wait: 2500 },
  { file: '07_dupont_table.png', url: '/dupont-table.html', wait: 2000 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
};

function startServer() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = join(ROOT, p.replace(/^\//, ''));
      if (!fp.startsWith(ROOT) || !existsSync(fp)) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const ext = extname(fp);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(fp));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function capture(page, item) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${PORT}${item.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    if (typeof Charts !== 'undefined') Charts.resizeAll();
  });
  await page.waitForTimeout(item.wait);
  await page.evaluate(() => {
    if (typeof Charts !== 'undefined') Charts.resizeAll();
  });
  const main = page.locator('.main-content');
  const box = await main.boundingBox();
  const out = join(OUT, item.file);
  if (box) {
    await page.screenshot({
      path: out,
      clip: { x: box.x, y: box.y, width: Math.min(box.width, 1280 - box.x), height: Math.min(box.height, 720) },
      type: 'png',
    });
  } else {
    await page.screenshot({ path: out, fullPage: false, type: 'png' });
  }
  console.log('✓', item.file);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const item of PAGES) await capture(page, item);
    // 总览墙自身
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, '01_index.png'), fullPage: true, type: 'png' });
    console.log('✓ 01_index.png');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
