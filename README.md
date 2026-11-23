# Vet Video Cloud Studio

Cloud-rendered HD Veterinary Medicine & Anatomy Lecture Video Studio powered by **Remotion** + **GitHub Actions** (**0% local CPU/GPU rendering load**).

## Key Features
- **Zero local rendering load**: Your PC never runs heavy video encoding. GitHub Actions cloud runners render HD (`1280×720` or `1920×1080`) H.264 MP4 videos with zero watermarks.
- **Scientifically accurate veterinary anatomy plates**:
  - `scripts/fetch_anatomy.py`: Fetches verified open-access veterinary anatomical diagrams from Wikimedia Commons API with full source attribution.
  - `scripts/extract_pdf_images.py`: Extracts exact anatomical diagrams straight from your lecture PDFs.
- **Veterinary scene templates**: `title`, `anatomy` (with exact coordinate-calibrated animated arrows, pulsing pins & camera spotlight zoom), `comparison` (multi-species anatomy), `clinical` (clinical pearls), and `mindmap` (animated SVG mind map).
- **Audio support**: Attach your own `.wav`/`.mp3` (e.g. from Google AI Studio TTS) or use built-in free cloud Arabic/English TTS (`edge-tts`).

## Quick Workflow
1. Create a lecture folder under `lectures/<lecture-id>/` with `manifest.json`, `images/`, and optional audio file.
2. Push to GitHub: `git add . && git commit -m "Add lecture" && git push`
3. Trigger cloud render:
   ```bash
   gh workflow run render-video.yml -f lecture=demo-ruminant-stomach -f resolution=1280x720 -f crf=20
   ```
4. Download the finished MP4 directly from GitHub Actions:
   ```bash
   gh run download --name vet-video-demo-ruminant-stomach -D ./downloads
   ```
