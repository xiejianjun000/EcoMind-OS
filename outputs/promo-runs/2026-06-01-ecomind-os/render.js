#!/usr/bin/env node
/**
 * render.js — Playwright + ffmpeg frame renderer for master-edit.html
 * Captures frames at 30fps from GSAP timeline, then encodes to MP4
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FPS = 30;
const TOTAL_SECONDS = 180;
const TOTAL_FRAMES = FPS * TOTAL_SECONDS; // 5400
const WIDTH = 1920;
const HEIGHT = 1080;

const PROJECT_DIR = path.resolve(__dirname);
const HTML_FILE = path.join(PROJECT_DIR, 'master-edit.html');
const FRAMES_DIR = path.join(PROJECT_DIR, 'frames');
const FINAL_DIR = path.join(PROJECT_DIR, 'final');
const OUTPUT_MP4 = path.join(FINAL_DIR, 'promo.mp4');

// For faster preview: render fewer frames
const PREVIEW_MODE = process.argv.includes('--preview');
const PREVIEW_FPS = 15;
const PREVIEW_FRAMES = PREVIEW_FPS * TOTAL_SECONDS; // 2700

const activeFps = PREVIEW_MODE ? PREVIEW_FPS : FPS;
const activeFrames = PREVIEW_MODE ? PREVIEW_FRAMES : TOTAL_FRAMES;

async function main() {
  console.log(`[render] Mode: ${PREVIEW_MODE ? 'PREVIEW (15fps)' : 'FULL (30fps)'}`);
  console.log(`[render] Total frames: ${activeFrames}`);
  console.log(`[render] Resolution: ${WIDTH}x${HEIGHT}`);

  // Ensure directories
  if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
  if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR, { recursive: true });

  // Clean old frames
  const oldFrames = fs.readdirSync(FRAMES_DIR).filter(f => f.endsWith('.png'));
  if (oldFrames.length > 0) {
    console.log(`[render] Cleaning ${oldFrames.length} old frames...`);
    oldFrames.forEach(f => fs.unlinkSync(path.join(FRAMES_DIR, f)));
  }

  console.log('[render] Launching Playwright Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-breakpad',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  console.log('[render] Loading HTML...');
  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for GSAP to load
  await page.waitForFunction(() => window.__timelines && window.__timelines.promo, { timeout: 10000 });
  console.log('[render] GSAP timeline ready.');

  // Prepare for capture: hide controls, reset transform
  await page.evaluate(() => {
    const tl = window.__timelines.promo;
    tl.seek(0);
    tl.pause();
    const ctrl = document.getElementById('controls');
    if (ctrl) ctrl.style.display = 'none';
    const root = document.getElementById('root');
    if (root) {
      root.style.transform = 'none';
      root.style.transformOrigin = 'top left';
    }
  });

  console.log('[render] Starting frame capture...');

  const frameInterval = 1 / activeFps;
  let lastProgress = -1;
  const startTime = Date.now();

  for (let frame = 0; frame < activeFrames; frame++) {
    const time = frame * frameInterval;

    // Seek timeline to current time
    await page.evaluate((t) => {
      const tl = window.__timelines.promo;
      tl.seek(t);
    }, time);

    // Capture screenshot
    const frameNum = String(frame + 1).padStart(5, '0');
    const framePath = path.join(FRAMES_DIR, `frame_${frameNum}.png`);

    await page.screenshot({
      path: framePath,
      type: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });

    // Progress reporting every 5%
    const progress = Math.floor((frame / activeFrames) * 100);
    if (progress > lastProgress && progress % 5 === 0) {
      lastProgress = progress;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = ((frame + 1) / (elapsed || 1)).toFixed(1);
      const eta = ((activeFrames - frame) / (rate || 1) / 60).toFixed(1);
      const tc = formatTimecode(time);
      console.log(`[render] ${progress}% — frame ${frame + 1}/${activeFrames} @ ${tc} — ${rate} fps — ETA ${eta}min`);
    }
  }

  console.log('[render] Frame capture complete.');
  await browser.close();

  // Encode with ffmpeg
  console.log('[render] Encoding MP4 with ffmpeg...');
  const ffmpegCmd = [
    'ffmpeg',
    '-y',
    `-framerate ${activeFps}`,
    `-i ${path.join(FRAMES_DIR, 'frame_%05d.png')}`,
    '-c:v libx264',
    '-pix_fmt yuv420p',
    '-preset medium',
    '-crf 18',
    OUTPUT_MP4,
  ].join(' ');

  try {
    execSync(ffmpegCmd, { stdio: 'inherit', timeout: 300000 });
    console.log(`[render] MP4 encoded: ${OUTPUT_MP4}`);

    const stats = fs.statSync(OUTPUT_MP4);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`[render] File size: ${sizeMB} MB`);
  } catch (err) {
    console.error('[render] ffmpeg encoding failed:', err.message);
    console.log('[render] Frames are preserved in:', FRAMES_DIR);
  }

  console.log('[render] Done!');
}

function formatTimecode(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

main().catch(err => {
  console.error('[render] Fatal error:', err);
  process.exit(1);
});
