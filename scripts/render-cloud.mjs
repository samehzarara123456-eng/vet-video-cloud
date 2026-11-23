import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const lectureName = process.argv[2] || process.env.LECTURE_NAME || 'demo-ruminant-stomach';
const resolution = process.argv[3] || process.env.VIDEO_RESOLUTION || '1280x720';
const crf = process.argv[4] || process.env.VIDEO_CRF || '20';

const rootDir = process.cwd();
const lectureDir = path.join(rootDir, 'lectures', lectureName);
const manifestPath = path.join(lectureDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`ERROR: Lecture manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Apply resolution override if provided (e.g., 1280x720 or 1920x1080)
const [wStr, hStr] = resolution.split('x');
if (Number(wStr) > 0 && Number(hStr) > 0) {
  manifest.width = Number(wStr);
  manifest.height = Number(hStr);
}
manifest.fps = manifest.fps || 30;

// Stage lecture assets into public/lecture/ so Remotion staticFile() serves them cleanly
const publicLectureDir = path.join(rootDir, 'public', 'lecture');
fs.rmSync(publicLectureDir, { recursive: true, force: true });
fs.mkdirSync(publicLectureDir, { recursive: true });
fs.cpSync(lectureDir, publicLectureDir, { recursive: true });

// Optional Cloud TTS via edge-tts if no audio file was pre-supplied
if (!manifest.audioFile && manifest.tts && manifest.tts.text) {
  const ttsFile = 'cloud-tts.mp3';
  const ttsOut = path.join(publicLectureDir, ttsFile);
  const voice = manifest.tts.voice || 'ar-EG-ShakirNeural';
  const rate = manifest.tts.rate || '+0%';
  console.log(`Generating cloud narration via edge-tts (${voice})...`);
  const ttsRes = spawnSync(
    'edge-tts',
    ['--voice', voice, `--rate=${rate}`, '--text', manifest.tts.text, '--write-media', ttsOut],
    { stdio: 'inherit' }
  );
  if (ttsRes.status === 0 && fs.existsSync(ttsOut)) {
    manifest.audioFile = ttsFile;
  } else {
    console.warn('Warning: edge-tts did not produce audio; continuing without audio track.');
  }
}

// Probe exact natural dimensions of every image in images/ using ffprobe
const imagesDir = path.join(publicLectureDir, 'images');
manifest.imageDims = {};
if (fs.existsSync(imagesDir)) {
  for (const file of fs.readdirSync(imagesDir)) {
    const full = path.join(imagesDir, file);
    if (!fs.statSync(full).isFile()) continue;
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
      const parsed = JSON.parse(out);
      const stream = parsed.streams?.[0];
      if (stream?.width && stream?.height) {
        manifest.imageDims[file] = { width: Number(stream.width), height: Number(stream.height) };
      }
    } catch {
      // Non-image file or ffprobe skipped
    }
  }
}

// If an audio file exists, ensure total scene duration covers full audio duration
if (manifest.audioFile) {
  const audioFull = path.join(publicLectureDir, manifest.audioFile);
  if (fs.existsSync(audioFull)) {
    try {
      const durStr = execFileSync(
        'ffprobe',
        [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          audioFull,
        ],
        { encoding: 'utf8' }
      ).trim();
      const audioDur = parseFloat(durStr);
      const scenesSum = manifest.scenes.reduce((acc, s) => acc + (s.durationSec || 0), 0);
      if (Number.isFinite(audioDur) && audioDur > scenesSum && manifest.scenes.length > 0) {
        const extra = Number((audioDur - scenesSum + 0.6).toFixed(2));
        manifest.scenes[manifest.scenes.length - 1].durationSec += extra;
        console.log(`Extended final scene by +${extra}s to match full audio duration (${audioDur.toFixed(2)}s).`);
      }
    } catch {
      console.warn('Could not probe audio duration; using manifest scene durations.');
    }
  }
}

const outDir = path.join(rootDir, 'out');
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, `${lectureName}.props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ manifest }, null, 2), 'utf8');

const rawMp4 = path.join(outDir, `${lectureName}.raw.mp4`);
const finalMp4 = path.join(outDir, `${lectureName}.mp4`);

console.log(`Rendering "${lectureName}" at ${manifest.width}x${manifest.height} @ ${manifest.fps}fps (CRF ${crf})...`);

const renderArgs = [
  'remotion',
  'render',
  'src/index.ts',
  'VetLecture',
  rawMp4,
  `--props=${propsFile}`,
  '--codec=h264',
  `--crf=${crf}`,
  '--pixel-format=yuv420p',
  '--audio-codec=aac',
  '--audio-bitrate=128k',
  '--concurrency=4',
];

const renderRes = spawnSync('npx', renderArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
if (renderRes.status !== 0) {
  console.error('Remotion cloud render failed.');
  process.exit(renderRes.status || 1);
}

// Fast-start MP4 remux (lossless stream copy) for instant mobile/web playback
const remuxRes = spawnSync(
  'ffmpeg',
  ['-y', '-i', rawMp4, '-c', 'copy', '-movflags', '+faststart', finalMp4],
  { stdio: 'inherit' }
);

if (remuxRes.status === 0 && fs.existsSync(finalMp4)) {
  fs.rmSync(rawMp4, { force: true });
} else {
  fs.renameSync(rawMp4, finalMp4);
}

const sizeMb = (fs.statSync(finalMp4).size / (1024 * 1024)).toFixed(2);
console.log(`SUCCESS: Rendered ${finalMp4} (${sizeMb} MB)`);
