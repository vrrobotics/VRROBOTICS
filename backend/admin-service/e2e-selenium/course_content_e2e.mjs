/**
 * Selenium e2e — drives the REAL admin UI to verify the per-course storage
 * layout end-to-end:
 *   login → /admin/course/create → fill form + upload thumbnail → submit →
 *   land on /admin/course/edit/<id> → open Media tab → assert the thumbnail
 *   <img> src points at .../courses/<id>/thumbnail/... (Cloudflare R2).
 *
 * The lesson PDF/video-URL → Bunny paths are verified programmatically by the
 * backend integration test; this script proves the "course adding stores
 * everything under one per-course location" path through the actual browser.
 *
 * Prereqs (one-time):
 *   cd YagnaTechOrg/backend/admin-service/e2e-selenium
 *   npm init -y && npm i selenium-webdriver
 *   # Chrome must be installed. selenium-webdriver 4.x auto-manages chromedriver.
 *
 * Run:
 *   FRONTEND_URL=http://localhost:5173 \
 *   ADMIN_EMAIL=vrroot@vrroboticsacademy.com \
 *   ADMIN_PASSWORD=*** \
 *   node course_content_e2e.mjs
 *
 * Windows PowerShell:
 *   $env:FRONTEND_URL="http://localhost:5173"; $env:ADMIN_EMAIL="..."; $env:ADMIN_PASSWORD="..."; node course_content_e2e.mjs
 *
 * Options:
 *   HEADLESS=false   → watch the browser drive the form (default: headless)
 *
 * Data prerequisites in the DB (the create form requires them):
 *   - at least one instructor, one language, and one college must exist.
 */
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const HEADLESS = process.env.HEADLESS !== 'false';

if (!EMAIL || !PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');
    process.exit(2);
}

// 1x1 PNG so we don't need an image-generation lib.
const thumbPath = path.join(os.tmpdir(), 'e2e-thumb.png');
fs.writeFileSync(thumbPath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
));

const results = [];
const log = (passed, name, extra = '') => {
    results.push(passed);
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

// Pick the first <option> with a non-empty value in a native <select>.
async function selectFirstReal(driver, id) {
    const sel = await driver.wait(until.elementLocated(By.id(id)), 15000);
    const opts = await sel.findElements(By.css('option'));
    for (const o of opts) {
        const v = (await o.getAttribute('value') || '').trim();
        if (v) { await o.click(); return v; }
    }
    throw new Error(`no selectable option in #${id} (is the underlying data seeded?)`);
}

// Click any clickable element whose visible text matches (tabs are buttons/divs).
async function clickByText(driver, text) {
    const el = await driver.wait(until.elementLocated(
        By.xpath(`//*[self::button or self::a or self::div or self::li or self::span][normalize-space(.)='${text}']`),
    ), 10000);
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
    await el.click();
}

async function run() {
    const options = new chrome.Options();
    if (HEADLESS) options.addArguments('--headless=new');
    options.addArguments('--window-size=1400,1000', '--no-sandbox', '--disable-dev-shm-usage');
    const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    try {
        console.log(`\n=== Selenium e2e against ${FRONTEND} ===\n`);

        // --- LOGIN ---------------------------------------------------------
        await driver.get(`${FRONTEND}/login`);
        await driver.wait(until.elementLocated(By.id('email')), 15000);
        await driver.findElement(By.id('email')).sendKeys(EMAIL);
        await driver.findElement(By.id('password')).sendKeys(PASSWORD);
        await driver.findElement(By.css('button[type="submit"]')).click();
        await driver.wait(until.urlContains('/admin'), 25000);
        log((await driver.getCurrentUrl()).includes('/admin'), 'login → admin shell', await driver.getCurrentUrl());

        // --- CREATE COURSE -------------------------------------------------
        await driver.get(`${FRONTEND}/admin/course/create`);
        await driver.wait(until.elementLocated(By.id('title')), 15000);
        const title = `Selenium E2E ${Date.now()}`;
        await driver.findElement(By.id('title')).sendKeys(title);

        await selectFirstReal(driver, 'level');
        await selectFirstReal(driver, 'language');
        await selectFirstReal(driver, 'instructor_id');

        // College multi-select: open the trigger, tick the first checkbox.
        const trigger = await driver.findElement(By.css("div[aria-haspopup='listbox']"));
        await trigger.click();
        const firstCb = await driver.wait(
            until.elementLocated(By.css(".absolute input[type='checkbox']")), 10000);
        await firstCb.click();
        await driver.findElement(By.id('title')).click(); // close dropdown

        // Free pricing so the price field isn't required.
        await driver.findElement(By.id('free')).click();

        // Upload thumbnail.
        await driver.findElement(By.id('thumbnail')).sendKeys(thumbPath);

        // Submit and wait for the redirect to the edit page.
        await driver.findElement(By.css('button[type="submit"]')).click();
        await driver.wait(until.urlContains('/admin/course/edit/'), 30000);
        const editUrl = await driver.getCurrentUrl();
        const courseId = editUrl.split('/admin/course/edit/')[1].split(/[/?#]/)[0];
        log(!!courseId, 'course created → redirected to edit', `course_id=${courseId}`);

        // --- VERIFY PER-COURSE R2 PATH ON MEDIA TAB ------------------------
        try { await clickByText(driver, 'Media'); } catch { /* tab may already be visible */ }
        const img = await driver.wait(
            until.elementLocated(By.css(`img[src*="/courses/${courseId}/"]`)), 15000);
        const src = await img.getAttribute('src');
        log(src.includes(`/courses/${courseId}/thumbnail/`),
            'thumbnail rendered under courses/<id>/thumbnail/', src);
        log(/^https?:\/\//.test(src), 'thumbnail is an absolute (R2) URL', src);
    } catch (e) {
        log(false, 'run completed without error', e.message);
    } finally {
        await driver.quit();
    }

    const failed = results.filter((r) => !r).length;
    console.log(`\n=== RESULT: ${results.length - failed} passed, ${failed} failed ===\n`);
    process.exit(failed ? 1 : 0);
}

run();
