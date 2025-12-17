#!/usr/bin/env node
/**
 * Clear localStorage key(s) in a running app using Puppeteer (Development Only).
 * Usage:
 *   node tools/clear-localstorage.js [url]
 * Example:
 *   node tools/clear-localstorage.js http://localhost:3000
 */
const puppeteer = require('puppeteer');

async function clear(url = 'http://localhost:3000') {
  console.log(`Opening ${url}...`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    const removed = await page.evaluate(() => {
      const key = 'meno_events';
      const exists = !!localStorage.getItem(key);
      if (exists) localStorage.removeItem(key);
      return exists;
    });
    if (removed) console.log('Removed meno_events from localStorage');
    else console.log('meno_events was not present in localStorage');
  } catch (err) {
    console.error('Failed:', err.message || err);
    await browser.close();
    process.exit(1);
  }
  await browser.close();
}

const url = process.argv[2] || 'http://localhost:3000';
clear(url).then(() => process.exit(0));
