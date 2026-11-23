#!/usr/bin/env node
/**
 * Method 2 Cloud Video Engine:
 * High-Design HTML/CSS/SVG Medical Slides (Chromium) + Silky FFmpeg Ken Burns & Crossfades.
 *
 * Designed specifically for GitHub Actions (0% local PC load, scales to 40-60 minute lectures).
 *
 * Usage:
 *   node scripts/render-slides-ffmpeg.mjs <lecture-id> [resolution] [crf] [motion-mode] [audio-url]
 *
 * Example:
 *   node scripts/render-slides-ffmpeg.mjs demo-vet-obstetrics 1920x1080 19 ken-burns
 */

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildSlideHtml } from './slides-template.mjs';

const require = createRequire(import.meta.url);

const lectureName = process.argv[2] || process.env.LECTURE_NAME || 'demo-vet-obstetrics';
const resolution = process.argv[3] || process.env.VIDEO_RESOLUTION || '1920x1080';
const crf = process.argv[4] || process.env.VIDEO_CRF || '19';
const motionMode = process.argv[5] || process.env.MOTION_MODE || 'ken-burns'; // 'ken-burns' | 'fast-still'
const externalAudioUrl = process.argv[6] || process.env.AUDIO_URL || '';

const rootDir = process.cwd();
const lectureDir = path.join(rootDir, 'slides-lectures', lectureName);
const deckPath = path.join(lectureDir, 'deck.json');
const imagesDir = path.join(lectureDir, 'images');

if (!fs.existsSync(deckPath)) {
  console.error(`ERROR: Slide deck not found at ${deckPath}`);
  process.exit(1);
}

const tStartAll = Date.now();
const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));

const [outW, outH] = resolution.split('x').map(Number);
if (!outW || !outH) {
  console.error(`Invalid resolution: ${resolution}`);
  process.exit(1);
}
const fps = deck.fps || 30;
const transitionDur = Number(deck.transitionDurationSec ?? 0.6);
const transitionType = deck.transitionType || 'fade';

const workDir = path.join(rootDir, 'out', `${lectureName}-work`);
const htmlDir = path.join(workDir, 'html');
const pngDir = path.join(workDir, 'png');
const audioDir = path.join(workDir, 'audio');
const clipsDir = path.join(workDir, 'clips');
const outDir = path.join(rootDir, 'out');

fs.rmSync(workDir, { recursive: true, force: true });
for (const d of [htmlDir, pngDir, audioDir, clipsDir, outDir]) {
  fs.mkdirSync(d, { recursive: true });
}

/* ============================================================================
 * Helpers
 * ============================================================================ */
function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
    let stderr = '';
    if (opts.silent && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}\n${stderr.slice(-1500)}`));
    });
  });
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runner() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

function probeDuration(mediaPath) {
  const out = execFileSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      mediaPath,
    ],
    { encoding: 'utf8' }
  ).trim();
  const val = parseFloat(out);
  if (!Number.isFinite(val) || val <= 0) {
    throw new Error(`Invalid media duration from ffprobe for ${mediaPath}: "${out}"`);
  }
  return val;
}

function probeImageDimensions(dir) {
  const dims = {};
  if (!fs.existsSync(dir)) return dims;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;
    try {
      const out = execFileSync(
        'ffprobe',
        [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height',
          '-of', 'json',
          full,
        ],
        { encoding: 'utf8' }
      );
      const stream = JSON.parse(out).streams?.[0];
      if (stream?.width && stream?.height) {
        dims[file] = { width: Number(stream.width), height: Number(stream.height) };
      }
    } catch {
      // ignore non-image files
    }
  }
  return dims;
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/* ============================================================================
 * STEP 1: Audio Track Preparation (User Audio OR Per-Slide Egyptian Arabic TTS)
 * ============================================================================ */
async function prepareAudioAndDurations() {
  const t0 = Date.now();
  const slides = deck.slides;
  const masterCleanAudio = path.join(audioDir, 'master_clean.m4a');

  // Case A: External URL or bundled audio file provided
  let customAudioPath = null;
  if (externalAudioUrl) {
    let dlUrl = externalAudioUrl.trim();
    const gdriveMatch = dlUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gdriveMatch) {
      dlUrl = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
    }
    customAudioPath = path.join(audioDir, 'external_input.audio');
    console.log(`[Audio] Downloading external audio URL...`);
    await runAsync('curl', ['-fsSL', '-L', dlUrl, '-o', customAudioPath]);
  } else if (deck.audioFile) {
    const localAudio = path.join(lectureDir, deck.audioFile);
    if (fs.existsSync(localAudio)) {
      customAudioPath = localAudio;
    }
  }

  if (customAudioPath) {
    console.log(`[Audio] Cleaning & normalizing supplied recording: ${customAudioPath}`);
    const filters = [];
    if (deck.audioProcessing?.enhance !== false) {
      filters.push('highpass=f=80', 'afftdn=nf=-25', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    }
    if (deck.audioProcessing?.trimSilence === true) {
      filters.push('silenceremove=stop_periods=-1:stop_duration=0.85:stop_threshold=-42dB');
    }
    const af = filters.length ? ['-af', filters.join(',')] : [];
    await runAsync(
      'ffmpeg',
      ['-y', '-i', customAudioPath, ...af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', masterCleanAudio],
      { silent: true }
    );

    const totalAudioDur = probeDuration(masterCleanAudio);
    const rawSlideDurs = slides.map((s) => Number(s.durationSec) || 8);
    const sumRaw = rawSlideDurs.reduce((a, b) => a + b, 0);
    // Scale slide durations proportionally if total differs from audio, or pad final slide
    const slideClipDurs = rawSlideDurs.map((d, idx) => {
      const scaled = (d / sumRaw) * totalAudioDur;
      return idx < slides.length - 1 ? scaled + transitionDur : scaled + 0.5;
    });

    console.log(`[Audio] Ready in ${((Date.now() - t0) / 1000).toFixed(1)}s (total audio: ${totalAudioDur.toFixed(2)}s)`);
    return { audioPath: masterCleanAudio, slideClipDurs, totalAudioDur };
  }

  // Case B: Per-slide Egyptian Arabic cloud narration (millisecond-accurate sync!)
  const voice = deck.tts?.voice || 'ar-EG-ShakirNeural';
  const rate = deck.tts?.rate || '+4%';
  const pausePadSec = 0.55;

  console.log(`[Audio] Generating per-slide Egyptian Arabic narration (${voice}, ${slides.length} slides)...`);
  const segFiles = await runPool(slides, 4, async (slide, idx) => {
    const rawMp3 = path.join(audioDir, `seg_${String(idx).padStart(3, '0')}.mp3`);
    const paddedWav = path.join(audioDir, `seg_${String(idx).padStart(3, '0')}.wav`);
    const text = (slide.narration || '').trim();

    if (text) {
      await runAsync(
        'edge-tts',
        ['--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', rawMp3],
        { silent: true }
      );
      await runAsync(
        'ffmpeg',
        [
          '-y',
          '-i', rawMp3,
          '-af', `apad=pad_dur=${pausePadSec}`,
          '-ar', '48000',
          '-ac', '2',
          paddedWav,
        ],
        { silent: true }
      );
    } else {
      const fallbackDur = Number(slide.durationSec) || 5;
      await runAsync(
        'ffmpeg',
        ['-y', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(fallbackDur), paddedWav],
        { silent: true }
      );
    }
    const dur = probeDuration(paddedWav);
    return { path: paddedWav, dur };
  });

  // Concatenate per-slide WAV segments into master clean AAC audio
  const concatList = path.join(audioDir, 'concat.txt');
  fs.writeFileSync(
    concatList,
    segFiles.map((s) => `file '${s.path.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );

  const enhanceFilter =
    deck.audioProcessing?.enhance !== false
      ? ['-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11']
      : [];

  await runAsync(
    'ffmpeg',
    [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatList,
      ...enhanceFilter,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      masterCleanAudio,
    ],
    { silent: true }
  );

  // Exact slide clip durations so xfade overlap aligns slide k with segment k start!
  const slideClipDurs = segFiles.map((s, idx) =>
    idx < segFiles.length - 1 ? s.dur + transitionDur : s.dur + 0.5
  );
  const totalAudioDur = probeDuration(masterCleanAudio);

  console.log(
    `[Audio] Per-slide narration + studio polish ready in ${((Date.now() - t0) / 1000).toFixed(1)}s (total audio: ${totalAudioDur.toFixed(2)}s)`
  );
  return { audioPath: masterCleanAudio, slideClipDurs, totalAudioDur };
}

/* ============================================================================
 * STEP 2: Render HTML/CSS/SVG Medical Slides -> Supersampled PNGs via Chrome
 * ============================================================================ */
async function renderSlidesToPngs(imageDims) {
  const t0 = Date.now();
  const slides = deck.slides;
  const htmlPaths = slides.map((slide, idx) => {
    const html = buildSlideHtml({
      slide,
      slideIdx: idx,
      totalSlides: slides.length,
      deck,
      imagesDir,
      imageDims,
    });
    const outHtml = path.join(htmlDir, `slide_${String(idx + 1).padStart(3, '0')}.html`);
    fs.writeFileSync(outHtml, html, 'utf8');
    return outHtml;
  });

  // Load playwright-core via createRequire so isolated /tmp/pw installs work seamlessly in ESM
  const pwModule = process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core';
  const { chromium } = require(pwModule);
  const executablePath = findChromeExecutable();
  console.log(`[Slides] Rendering ${slides.length} HD HTML/SVG slides via Chromium (${executablePath || 'bundled'})...`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  // Render at 1.5x (2880x1620) when Ken Burns is active so zoompan downsampling is glass-smooth!
  const dpr = motionMode === 'ken-burns' && outW >= 1920 ? 1.5 : 1;

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: dpr,
    });

    const pngPaths = await runPool(htmlPaths, 4, async (htmlPath, idx) => {
      const page = await context.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });
      await page.waitForTimeout(180);
      const outPng = path.join(pngDir, `slide_${String(idx + 1).padStart(3, '0')}.png`);
      await page.screenshot({ path: outPng, type: 'png' });
      await page.close();
      return outPng;
    });

    await context.close();
    console.log(`[Slides] Rendered ${pngPaths.length} PNGs (${1920 * dpr}x${1080 * dpr}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return pngPaths;
  } finally {
    await browser.close();
  }
}

/* ============================================================================
 * STEP 3: Render Per-Slide Video Clips in Parallel (4 Cores) via FFmpeg
 * ============================================================================ */
function buildMotionFilter(slide, durSec) {
  if (motionMode === 'fast-still') {
    return `scale=${outW}:${outH}:flags=lanczos,fps=${fps},format=yuv420p,setsar=1`;
  }

  const totalFrames = Math.max(1, Math.round(durSec * fps));
  const motion = slide.motion || { type: 'zoom-in' };
  const p = `min(1,on/${totalFrames})`;

  let zExpr = `1+0.042*${p}`;
  let xExpr = 'iw/2-(iw/zoom/2)';
  let yExpr = 'ih/2-(ih/zoom/2)';

  if (motion.type === 'zoom-out') {
    zExpr = `1.042-0.042*${p}`;
  } else if (motion.type === 'focus-zoom') {
    const fx = Number(motion.focusX ?? 0.5);
    const fy = Number(motion.focusY ?? 0.5);
    zExpr = `1+0.065*${p}`;
    xExpr = `max(0,min(iw-iw/zoom,iw*${fx}-(iw/zoom)/2))`;
    yExpr = `max(0,min(ih-ih/zoom,ih*${fy}-(ih/zoom)/2))`;
  }

  return `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${outW}x${outH}:fps=${fps},format=yuv420p,setsar=1`;
}

async function encodeSlideClips(pngPaths, slideClipDurs) {
  const t0 = Date.now();
  console.log(`[FFmpeg] Encoding ${pngPaths.length} slide clips in parallel (mode=${motionMode}, ${outW}x${outH}@${fps}fps)...`);

  const clipMeta = await runPool(pngPaths, 4, async (pngPath, idx) => {
    const slide = deck.slides[idx];
    const targetDur = slideClipDurs[idx];
    const clipPath = path.join(clipsDir, `clip_${String(idx + 1).padStart(3, '0')}.mp4`);

    if (motionMode === 'fast-still') {
      await runAsync(
        'ffmpeg',
        [
          '-y',
          '-loop', '1',
          '-framerate', String(fps),
          '-t', targetDur.toFixed(3),
          '-i', pngPath,
          '-vf', buildMotionFilter(slide, targetDur),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-tune', 'stillimage',
          '-crf', String(Math.max(16, Number(crf) - 2)),
          '-pix_fmt', 'yuv420p',
          '-r', String(fps),
          clipPath,
        ],
        { silent: true }
      );
    } else {
      await runAsync(
        'ffmpeg',
        [
          '-y',
          '-i', pngPath,
          '-vf', buildMotionFilter(slide, targetDur),
          '-t', targetDur.toFixed(3),
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', String(Math.max(16, Number(crf) - 2)),
          '-pix_fmt', 'yuv420p',
          '-r', String(fps),
          clipPath,
        ],
        { silent: true }
      );
    }

    const actualDur = probeDuration(clipPath);
    return { path: clipPath, dur: actualDur };
  });

  console.log(`[FFmpeg] Encoded ${clipMeta.length} slide clips in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return clipMeta;
}

/* ============================================================================
 * STEP 4: Batched Smooth Crossfade Joiner (Scales to 200+ Slides / 60-Min Lectures)
 * ============================================================================ */
async function joinWithCrossfades(clips, outVideoPath, finalCrf) {
  if (clips.length === 1) {
    fs.copyFileSync(clips[0].path, outVideoPath);
    return;
  }

  // Batch into groups of 12 to keep FFmpeg memory flat even on 60-minute lectures
  const BATCH_SIZE = 12;
  if (clips.length > BATCH_SIZE) {
    const batchOutputs = [];
    for (let start = 0; start < clips.length; start += BATCH_SIZE) {
      const group = clips.slice(start, start + BATCH_SIZE);
      const batchPath = path.join(clipsDir, `batch_${batchOutputs.length}.mp4`);
      await joinWithCrossfades(group, batchPath, Math.max(16, Number(finalCrf) - 2));
      batchOutputs.push({ path: batchPath, dur: probeDuration(batchPath) });
    }
    return joinWithCrossfades(batchOutputs, outVideoPath, finalCrf);
  }

  const inputs = [];
  const normLines = [];
  for (let i = 0; i < clips.length; i++) {
    inputs.push('-i', clips[i].path);
    normLines.push(`[${i}:v]settb=AVTB,fps=${fps},format=yuv420p,setsar=1[v${i}]`);
  }

  const xfadeLines = [];
  let accDur = clips[0].dur;
  let prevLabel = '[v0]';

  for (let i = 1; i < clips.length; i++) {
    const offset = Math.max(0.1, accDur - transitionDur);
    const outLabel = i === clips.length - 1 ? '[vout]' : `[x${i}]`;
    xfadeLines.push(
      `${prevLabel}[v${i}]xfade=transition=${transitionType}:duration=${transitionDur.toFixed(3)}:offset=${offset.toFixed(3)}${outLabel}`
    );
    accDur = offset + clips[i].dur;
    prevLabel = outLabel;
  }

  const filterComplex = [...normLines, ...xfadeLines].join(';\n');
  const filterFile = path.join(workDir, `xfade_${path.basename(outVideoPath)}.txt`);
  fs.writeFileSync(filterFile, filterComplex, 'utf8');

  await runAsync(
    'ffmpeg',
    [
      '-y',
      ...inputs,
      '-filter_complex_script', filterFile,
      '-map', '[vout]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', String(finalCrf),
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      outVideoPath,
    ],
    { silent: true }
  );
}

/* ============================================================================
 * MAIN PIPELINE
 * ============================================================================ */
async function main() {
  console.log(`\n=============================================================`);
  console.log(` Vet Video Cloud — Method 2 (HTML/SVG Slides + FFmpeg Engine)`);
  console.log(` Lecture: ${lectureName} | ${outW}x${outH} @ ${fps}fps | Mode: ${motionMode} | CRF: ${crf}`);
  console.log(`=============================================================\n`);

  const imageDims = probeImageDimensions(imagesDir);
  const { audioPath, slideClipDurs, totalAudioDur } = await prepareAudioAndDurations();
  const pngPaths = await renderSlidesToPngs(imageDims);
  const clips = await encodeSlideClips(pngPaths, slideClipDurs);

  const tJoin = Date.now();
  const videoOnlyPath = path.join(workDir, 'video_joined.mp4');
  console.log(`[FFmpeg] Joining ${clips.length} clips with ${transitionDur}s '${transitionType}' crossfades...`);
  await joinWithCrossfades(clips, videoOnlyPath, crf);
  console.log(`[FFmpeg] Crossfades joined in ${((Date.now() - tJoin) / 1000).toFixed(1)}s`);

  const finalMp4 = path.join(outDir, `${lectureName}-slides.mp4`);
  await runAsync(
    'ffmpeg',
    [
      '-y',
      '-i', videoOnlyPath,
      '-i', audioPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-shortest',
      finalMp4,
    ],
    { silent: true }
  );

  // Also save preview PNGs of slides into out/<lecture>-previews for quick inspection
  const previewDir = path.join(outDir, `${lectureName}-slides-preview`);
  fs.rmSync(previewDir, { recursive: true, force: true });
  fs.cpSync(pngDir, previewDir, { recursive: true });

  const finalDur = probeDuration(finalMp4);
  const sizeMb = (fs.statSync(finalMp4).size / (1024 * 1024)).toFixed(2);
  const totalElapsed = ((Date.now() - tStartAll) / 1000).toFixed(1);

  console.log(`\n=============================================================`);
  console.log(` ✅ SUCCESS: ${finalMp4}`);
  console.log(` ⏱  Video Duration : ${finalDur.toFixed(1)}s (Audio: ${totalAudioDur.toFixed(1)}s)`);
  console.log(` 📦 File Size      : ${sizeMb} MB (${outW}x${outH} H.264 + AAC 192k)`);
  console.log(` 🚀 Cloud Render   : ${totalElapsed}s total pipeline time!`);
  console.log(`=============================================================\n`);
}

main().catch((err) => {
  console.error('\n❌ RENDER FAILED:', err.message || err);
  process.exit(1);
});
