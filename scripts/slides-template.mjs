import fs from 'node:fs';
import path from 'node:path';

/**
 * Escapes HTML special characters safely.
 */
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Loads an image from disk as a base64 Data URI so headless Chrome renders it
 * instantaneously with zero relative-path or file:// CORS issues.
 */
function loadImageDataUri(imagesDir, filename) {
  if (!filename) return '';
  const full = path.join(imagesDir, filename);
  if (!fs.existsSync(full)) {
    throw new Error(`Slide image not found: ${full}`);
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  const b64 = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${b64}`;
}

/**
 * Computes exact fitted image box dimensions (contain) inside a viewport stage
 * so percentage-based SVG callouts land on exact anatomical/clinical landmarks.
 */
function fitContain(imgW, imgH, maxW, maxH) {
  if (!imgW || !imgH) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return {
    w: Math.round(imgW * scale),
    h: Math.round(imgH * scale),
  };
}

/**
 * Renders the top clinical header bar for content slides.
 */
function renderHeader(slide, slideIdx, totalSlides, deck) {
  const numStr = `${String(slideIdx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
  return `
    <header class="slide-header">
      <div class="header-left" dir="ltr">
        <span class="section-pill">${esc(slide.sectionLabel || deck.courseBadge || 'Veterinary Medicine')}</span>
        <span class="slide-counter">${numStr}</span>
      </div>
      <div class="header-right">
        <h1 class="slide-title-ar" dir="rtl">${esc(slide.titleAr || '')}</h1>
        ${slide.titleEn ? `<div class="slide-title-en" dir="ltr">${esc(slide.titleEn)}</div>` : ''}
      </div>
    </header>
  `;
}

/**
 * Renders the persistent bottom chapter progress bar across slides.
 */
function renderProgressBar(chapters = [], activeChapterIdx = 0) {
  if (!chapters || chapters.length === 0) return '';
  const items = chapters
    .map((ch, idx) => {
      const state = idx < activeChapterIdx ? 'done' : idx === activeChapterIdx ? 'active' : 'upcoming';
      return `
        <div class="chapter-item ${state}" dir="rtl">
          <span class="chapter-dot"></span>
          <span class="chapter-name">${esc(ch)}</span>
        </div>
      `;
    })
    .join('');
  return `
    <footer class="chapter-bar">
      <div class="chapter-track">${items}</div>
    </footer>
  `;
}

/**
 * Renders precision SVG callout arrows + glowing landmark rings + floating bilingual pills
 * calibrated to the exact fitted image box (boxW x boxH).
 */
function renderCalloutOverlay(callouts = [], boxW, boxH) {
  if (!callouts || callouts.length === 0) return '';

  const svgParts = callouts
    .map((c) => {
      const color = c.color || '#14B8A6';
      const tx = (c.targetX / 100) * boxW;
      const ty = (c.targetY / 100) * boxH;
      const lx = (c.labelX / 100) * boxW;
      const ly = (c.labelY / 100) * boxH;
      const dx = tx - lx;
      const dy = ty - ly;
      const angle = Math.atan2(dy, dx);
      const headLen = 15;
      const ringR = c.ringRadius || 20;

      // Stop arrow neatly at edge of the target ring
      const dist = Math.hypot(dx, dy) || 1;
      const stopDist = Math.max(0, dist - ringR - 4);
      const ex = lx + (dx / dist) * stopDist;
      const ey = ly + (dy / dist) * stopDist;

      const ax1 = ex - headLen * Math.cos(angle - Math.PI / 6);
      const ay1 = ey - headLen * Math.sin(angle - Math.PI / 6);
      const ax2 = ex - headLen * Math.cos(angle + Math.PI / 6);
      const ay2 = ey - headLen * Math.sin(angle + Math.PI / 6);

      return `
        <g>
          <!-- Outer soft halo around clinical landmark -->
          <circle cx="${tx}" cy="${ty}" r="${ringR + 8}" fill="${color}" fill-opacity="0.16" />
          <circle cx="${tx}" cy="${ty}" r="${ringR}" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-opacity="0.9" />
          <circle cx="${tx}" cy="${ty}" r="${ringR}" fill="none" stroke="${color}" stroke-width="3.2" stroke-dasharray="7 4" />
          <circle cx="${tx}" cy="${ty}" r="5.5" fill="${color}" stroke="#FFFFFF" stroke-width="2.2" />

          <!-- Contrast-backed pointer line -->
          <line x1="${lx}" y1="${ly}" x2="${ex}" y2="${ey}" stroke="#FFFFFF" stroke-width="6.5" stroke-linecap="round" stroke-opacity="0.92" />
          <line x1="${lx}" y1="${ly}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="3.4" stroke-linecap="round" />
          ${
            dist > ringR + 18
              ? `<polygon points="${ex},${ey} ${ax1},${ay1} ${ax2},${ay2}" fill="${color}" stroke="#FFFFFF" stroke-width="1.5" />`
              : ''
          }
        </g>
      `;
    })
    .join('');

  const pillParts = callouts
    .map((c) => {
      const color = c.color || '#14B8A6';
      return `
        <div class="callout-pill" style="left:${c.labelX}%; top:${c.labelY}%; border-color:${color};">
          ${c.badge ? `<span class="callout-num" style="background:${color};">${esc(c.badge)}</span>` : ''}
          <div class="callout-texts">
            <div class="callout-en" dir="ltr">${esc(c.label)}</div>
            ${c.sublabel ? `<div class="callout-ar" dir="rtl">${esc(c.sublabel)}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <svg class="callout-svg" width="${boxW}" height="${boxH}" viewBox="0 0 ${boxW} ${boxH}">
      ${svgParts}
    </svg>
    ${pillParts}
  `;
}

/* ============================================================================
 * SLIDE TYPE 1: HERO TITLE
 * ============================================================================ */
function renderHeroTitle(slide, deck, imagesDir) {
  const heroImg = slide.image ? loadImageDataUri(imagesDir, slide.image) : '';
  const speciesPills = (slide.species || [])
    .map((sp) => `<span class="species-pill">${esc(sp)}</span>`)
    .join('');
  const outlineChips = (slide.topics || [])
    .map(
      (t, i) => `
      <div class="hero-topic-chip" dir="rtl">
        <span class="hero-topic-idx">0${i + 1}</span>
        <span>${esc(t)}</span>
      </div>`
    )
    .join('');

  return `
    <div class="hero-layout">
      <div class="hero-visual">
        ${heroImg ? `<img src="${heroImg}" class="hero-photo" />` : ''}
        <div class="hero-photo-fade"></div>
        ${
          slide.imageCredit
            ? `<div class="credit-pill hero-credit" dir="ltr">Verified Source: ${esc(slide.imageCredit)}</div>`
            : ''
        }
        <div class="verified-badge" dir="rtl">
          <span class="verified-dot"></span>
          <span>صور إكلينيكية وتشريحية حقيقية 100%</span>
        </div>
      </div>

      <div class="hero-content" dir="rtl">
        <div class="hero-course-badge" dir="ltr">${esc(slide.courseBadge || deck.courseBadge || 'Veterinary Medicine')}</div>
        <h1 class="hero-title-ar">${esc(slide.titleAr)}</h1>
        <div class="hero-title-en" dir="ltr">${esc(slide.titleEn)}</div>
        ${slide.subtitle ? `<p class="hero-subtitle">${esc(slide.subtitle)}</p>` : ''}

        ${speciesPills ? `<div class="species-row" dir="ltr">${speciesPills}</div>` : ''}

        ${
          outlineChips
            ? `<div class="hero-topics-box">
                <div class="hero-topics-label">محاور المحاضرة</div>
                <div class="hero-topics-grid">${outlineChips}</div>
              </div>`
            : ''
        }
      </div>
    </div>
  `;
}

/* ============================================================================
 * SLIDE TYPE 2: TIMELINE + CYCLE (Gestation Timeline SVG + Real Diagram Plate)
 * ============================================================================ */
function renderTimelineCycle(slide, imagesDir) {
  const diagramUri = slide.image ? loadImageDataUri(imagesDir, slide.image) : '';
  const totalDays = slide.totalDays || 289;
  const earlyDays = slide.earlyDays || 89;
  const focusDays = totalDays - earlyDays;
  const earlyPct = Math.round((earlyDays / totalDays) * 100);
  const focusPct = 100 - earlyPct;

  const milestonesHtml = (slide.milestones || [])
    .map(
      (m) => `
      <div class="milestone-card" style="border-right-color:${m.color || '#14B8A6'};" dir="rtl">
        <div class="milestone-top">
          <span class="milestone-title-ar">${esc(m.titleAr)}</span>
          <span class="milestone-tag" dir="ltr" style="color:${m.color || '#5EEAD4'}; border-color:${m.color || '#14B8A6'}55;">${esc(m.tagEn)}</span>
        </div>
        <div class="milestone-desc">${esc(m.desc)}</div>
      </div>`
    )
    .join('');

  return `
    <div class="timeline-layout">
      <!-- Top Visual Gestation Timeline Panel -->
      <div class="timeline-panel">
        <div class="timeline-panel-head">
          <span class="tp-en" dir="ltr">${esc(slide.timelineTitleEn || `Bovine Gestation Period: ${totalDays} Days`)}</span>
          <span class="tp-ar" dir="rtl">${esc(slide.timelineTitleAr || `فترة الحمل الكاملة في الأبقار (${totalDays} يوم)`)}</span>
        </div>

        <div class="gestation-bar-wrap" dir="ltr">
          <div class="gestation-seg early" style="width:${earlyPct}%;">
            <div class="seg-top">Days 1 – ${earlyDays}</div>
            <div class="seg-sub" dir="rtl">أول 3 شهور (${earlyDays} يوم)</div>
          </div>
          <div class="gestation-seg focus" style="width:${focusPct}%;">
            <div class="seg-glow-pill">★ Course Scope — نطاق الدراسة</div>
            <div class="seg-top">Days ${earlyDays + 1} – ${totalDays} (${focusDays} Days)</div>
            <div class="seg-sub" dir="rtl">آخر ${focusDays} يوم حتى الولادة (Parturition)</div>
          </div>
        </div>

        <div class="gestation-ticks" dir="ltr">
          <span>Day 0 • Conception</span>
          <span>Day ${earlyDays} • End of 3rd Month</span>
          <span>Day 200 • Rapid Fetal Growth</span>
          <span>Day ${totalDays} • Parturition (الولادة)</span>
        </div>
      </div>

      <!-- Bottom Split: Verified Estrous Cycle / Placenta Plate + Milestone Cards -->
      <div class="timeline-bottom">
        <div class="diagram-stage">
          ${
            diagramUri
              ? `<img src="${diagramUri}" class="diagram-img" />`
              : ''
          }
          ${
            slide.imageCaption
              ? `<div class="diagram-caption" dir="rtl">${esc(slide.imageCaption)}</div>`
              : ''
          }
          ${
            slide.imageCredit
              ? `<div class="credit-pill" dir="ltr">Source: ${esc(slide.imageCredit)}</div>`
              : ''
          }
        </div>

        <div class="milestones-col">
          ${milestonesHtml}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================================
 * SLIDE TYPE 3: CLINICAL / ANATOMY PHOTO WITH CALIBRATED CALLOUTS
 * ============================================================================ */
function renderClinicalPhoto(slide, imagesDir, imageDims) {
  const imgUri = loadImageDataUri(imagesDir, slide.image);
  const dims = imageDims[slide.image] || { width: 1600, height: 1067 };

  // Main stage container in 1920x1080: width ~ 1150px, height ~ 790px
  const maxStageW = slide.keyPoints?.length ? 1120 : 1740;
  const maxStageH = 760;
  const { w: boxW, h: boxH } = fitContain(dims.width, dims.height, maxStageW, maxStageH);
  const isLightPlate = slide.lightPlateBg === true;

  const keyPointsHtml = (slide.keyPoints || [])
    .map(
      (kp, i) => `
      <div class="kp-card" style="border-right-color:${kp.color || '#14B8A6'};">
        <div class="kp-head">
          <span class="kp-num" style="background:${kp.color || '#14B8A6'};">${kp.badge || i + 1}</span>
          <span class="kp-term" dir="ltr">${esc(kp.term)}</span>
        </div>
        <div class="kp-note" dir="rtl">${esc(kp.note)}</div>
      </div>`
    )
    .join('');

  return `
    <div class="clinical-layout">
      <div class="photo-stage ${isLightPlate ? 'light-plate' : 'dark-plate'}">
        <div class="photo-fit-box" style="width:${boxW}px; height:${boxH}px;">
          <img src="${imgUri}" style="width:${boxW}px; height:${boxH}px; display:block; border-radius:12px;" />
          ${renderCalloutOverlay(slide.callouts, boxW, boxH)}
        </div>
        ${
          slide.imageCredit
            ? `<div class="credit-pill" dir="ltr">Verified Photo: ${esc(slide.imageCredit)}</div>`
            : ''
        }
      </div>

      ${
        keyPointsHtml
          ? `<aside class="kp-panel">
              <div class="kp-panel-title" dir="rtl">${esc(slide.sidePanelTitle || 'العلامات والنقاط التشريحية')}</div>
              <div class="kp-list">${keyPointsHtml}</div>
            </aside>`
          : ''
      }
    </div>
  `;
}

/* ============================================================================
 * SLIDE TYPE 4: SPLIT CLINICAL COMPARISON (e.g., Eutocia vs Dystocia)
 * ============================================================================ */
function renderSplitCompare(slide, imagesDir) {
  const renderCol = (col) => {
    const photoUri = col.image ? loadImageDataUri(imagesDir, col.image) : '';
    const accent = col.color || '#10B981';
    const items = (col.points || [])
      .map(
        (p) => `
        <div class="cmp-point" dir="rtl">
          <span class="cmp-check" style="background:${accent}22; color:${accent}; border-color:${accent}66;">${esc(col.icon || '✓')}</span>
          <div>
            <div class="cmp-point-title">${esc(p.title)}</div>
            ${p.detail ? `<div class="cmp-point-detail">${esc(p.detail)}</div>` : ''}
          </div>
        </div>`
      )
      .join('');

    const tags = (col.tags || [])
      .map((t) => `<span class="cmp-tag" style="border-color:${accent}55; color:${accent};">${esc(t)}</span>`)
      .join('');

    return `
      <div class="cmp-card" style="border-top-color:${accent};">
        <div class="cmp-card-head">
          <div dir="ltr">
            <div class="cmp-en" style="color:${accent};">${esc(col.titleEn)}</div>
            ${col.pronunciation ? `<div class="cmp-pron">${esc(col.pronunciation)}</div>` : ''}
          </div>
          <div class="cmp-ar" dir="rtl">${esc(col.titleAr)}</div>
        </div>

        ${
          photoUri
            ? `<div class="cmp-photo-wrap">
                <img src="${photoUri}" class="cmp-photo" />
                ${col.imageCaption ? `<div class="cmp-photo-cap" dir="rtl">${esc(col.imageCaption)}</div>` : ''}
              </div>`
            : ''
        }

        <div class="cmp-points">${items}</div>
        ${tags ? `<div class="cmp-tags" dir="ltr">${tags}</div>` : ''}
      </div>
    `;
  };

  return `
    <div class="compare-layout">
      <div class="compare-grid">
        ${renderCol(slide.left)}
        <div class="vs-badge">VS</div>
        ${renderCol(slide.right)}
      </div>
      ${
        slide.pearl
          ? `<div class="exam-pearl" dir="rtl">
              <span class="pearl-icon">💡 قاعدة ذهبية:</span>
              <span>${esc(slide.pearl)}</span>
            </div>`
          : ''
      }
    </div>
  `;
}

/* ============================================================================
 * SLIDE TYPE 5: CLINICAL CASE STUDY (12:00 AM Farm Call + Dual Real Photos)
 * ============================================================================ */
function renderCaseStudy(slide, imagesDir) {
  const photosHtml = (slide.photos || [])
    .map((p) => {
      const uri = loadImageDataUri(imagesDir, p.image);
      return `
        <div class="case-photo-card">
          <img src="${uri}" class="case-photo" />
          <div class="case-photo-overlay">
            <div class="case-photo-label-en" dir="ltr">${esc(p.labelEn)}</div>
            <div class="case-photo-label-ar" dir="rtl">${esc(p.labelAr)}</div>
          </div>
          ${p.credit ? `<div class="case-photo-credit" dir="ltr">${esc(p.credit)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  const signsHtml = (slide.reportedSigns || [])
    .map(
      (s, idx) => `
      <div class="case-sign-row" dir="rtl">
        <span class="case-sign-badge">${idx + 1}</span>
        <div>
          <span class="case-sign-ar">${esc(s.signAr)}</span>
          <span class="case-sign-en" dir="ltr"> — ${esc(s.signEn)}</span>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="case-layout">
      <div class="case-photos-col">${photosHtml}</div>

      <div class="case-details-col" dir="rtl">
        <div class="case-alert-banner">
          <span class="case-time" dir="ltr">${esc(slide.caseTime || '12:00 AM • CLINICAL CALL')}</span>
          <span class="case-species">${esc(slide.caseSpecies || 'حالة ولادة ميدانية')}</span>
        </div>

        <blockquote class="case-quote">"${esc(slide.ownerQuote)}"</blockquote>

        <div class="case-section-label">الأعراض الإكلينيكية المذكورة في الحالة:</div>
        <div class="case-signs-list">${signsHtml}</div>

        <div class="case-verdict">
          <div class="verdict-title">${esc(slide.verdictTitle || 'التشخيص المبدئي والقرار الطبي')}</div>
          <div class="verdict-body">${esc(slide.verdictBody)}</div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================================
 * SLIDE TYPE 6: SUMMARY MIND MAP / TAKEAWAY GRID
 * ============================================================================ */
function renderSummaryMap(slide, imagesDir) {
  const thumbUri = slide.image ? loadImageDataUri(imagesDir, slide.image) : '';
  const cardsHtml = (slide.branches || [])
    .map(
      (b) => `
      <div class="sum-card" style="border-top-color:${b.color || '#14B8A6'};">
        <div class="sum-card-head">
          <span class="sum-badge" style="background:${b.color || '#14B8A6'}24; color:${b.color || '#5EEAD4'};" dir="ltr">${esc(b.badge)}</span>
          <span class="sum-title-ar" dir="rtl">${esc(b.titleAr)}</span>
        </div>
        <ul class="sum-bullets" dir="rtl">
          ${(b.items || []).map((it) => `<li>${esc(it)}</li>`).join('')}
        </ul>
      </div>`
    )
    .join('');

  return `
    <div class="summary-layout">
      <div class="summary-top-banner">
        ${thumbUri ? `<img src="${thumbUri}" class="summary-thumb" />` : ''}
        <div class="summary-center-text" dir="rtl">
          <div class="summary-kicker" dir="ltr">${esc(slide.kickerEn || 'CLINICAL SUMMARY & KEY TAKEAWAYS')}</div>
          <div class="summary-headline">${esc(slide.headlineAr)}</div>
        </div>
      </div>

      <div class="summary-grid">${cardsHtml}</div>

      ${
        slide.closingNote
          ? `<div class="summary-footer-note" dir="rtl">${esc(slide.closingNote)}</div>`
          : ''
      }
    </div>
  `;
}

/**
 * Generates the complete standalone HTML document for a single 1920x1080 medical slide.
 */
export function buildSlideHtml({ slide, slideIdx, totalSlides, deck, imagesDir, imageDims }) {
  let bodyContent = '';
  switch (slide.type) {
    case 'hero-title':
      bodyContent = renderHeroTitle(slide, deck, imagesDir);
      break;
    case 'timeline-cycle':
      bodyContent = renderTimelineCycle(slide, imagesDir);
      break;
    case 'clinical-photo':
      bodyContent = renderClinicalPhoto(slide, imagesDir, imageDims);
      break;
    case 'split-compare':
      bodyContent = renderSplitCompare(slide, imagesDir);
      break;
    case 'case-study':
      bodyContent = renderCaseStudy(slide, imagesDir);
      break;
    case 'summary-map':
      bodyContent = renderSummaryMap(slide, imagesDir);
      break;
    default:
      throw new Error(`Unknown slide type: ${slide.type}`);
  }

  const isHero = slide.type === 'hero-title';
  const chapterIdx = slide.chapterIndex ?? slideIdx;

  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1920, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: #07111E;
      color: #F8FAFC;
      font-family: 'Cairo', 'Noto Sans Arabic', 'Plus Jakarta Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .canvas {
      position: relative;
      width: 1920px;
      height: 1080px;
      background:
        radial-gradient(circle at 14% 16%, rgba(20, 184, 166, 0.16), transparent 40%),
        radial-gradient(circle at 86% 84%, rgba(37, 99, 235, 0.14), transparent 44%),
        linear-gradient(155deg, #07111E 0%, #0C1C30 55%, #081525 100%);
      display: flex;
      flex-direction: column;
    }

    /* Subtle clinical dot matrix grid */
    .canvas::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px);
      background-size: 28px 28px;
      pointer-events: none;
    }

    .slide-inner {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: ${isHero ? '0' : '28px 52px 18px'};
      height: 1080px;
    }

    /* === HEADER === */
    .slide-header {
      height: 86px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      padding-bottom: 14px;
      margin-bottom: 20px;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .section-pill {
      padding: 8px 18px;
      border-radius: 10px;
      background: rgba(20, 184, 166, 0.14);
      border: 1px solid rgba(20, 184, 166, 0.42);
      color: #5EEAD4;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .slide-counter {
      padding: 7px 14px;
      border-radius: 10px;
      background: rgba(30, 41, 59, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.22);
      color: #94A3B8;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 700;
    }
    .header-right { text-align: right; }
    .slide-title-ar {
      font-size: 38px;
      font-weight: 900;
      color: #F8FAFC;
      line-height: 1.15;
    }
    .slide-title-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: #94A3B8;
      margin-top: 3px;
    }

    /* === MAIN BODY WRAPPER === */
    .slide-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* === BOTTOM CHAPTER BAR === */
    .chapter-bar {
      height: 52px;
      margin-top: 16px;
      display: flex;
      align-items: center;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      padding-top: 10px;
      flex-shrink: 0;
    }
    .chapter-track {
      width: 100%;
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      gap: 10px;
    }
    .chapter-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 16px;
      font-weight: 700;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.15);
      color: #64748B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chapter-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #475569;
      flex-shrink: 0;
    }
    .chapter-item.done {
      color: #94A3B8;
      border-color: rgba(20, 184, 166, 0.25);
    }
    .chapter-item.done .chapter-dot { background: #0D9488; }
    .chapter-item.active {
      background: rgba(20, 184, 166, 0.2);
      border-color: #14B8A6;
      color: #5EEAD4;
      box-shadow: 0 0 18px rgba(20, 184, 166, 0.22);
    }
    .chapter-item.active .chapter-dot {
      background: #2DD4BF;
      box-shadow: 0 0 8px #2DD4BF;
    }

    /* === CREDIT PILL === */
    .credit-pill {
      position: absolute;
      bottom: 14px;
      left: 16px;
      padding: 5px 12px;
      border-radius: 8px;
      background: rgba(7, 17, 30, 0.84);
      border: 1px solid rgba(148, 163, 184, 0.28);
      color: #CBD5E1;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
    }

    /* === HERO TITLE === */
    .hero-layout {
      display: flex;
      width: 1920px;
      height: 1080px;
    }
    .hero-visual {
      position: relative;
      width: 840px;
      height: 1080px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .hero-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    .hero-photo-fade {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(7,17,30,0.12) 0%, rgba(7,17,30,0.45) 68%, #07111E 100%),
        linear-gradient(180deg, rgba(7,17,30,0.3) 0%, transparent 25%, rgba(7,17,30,0.65) 100%);
    }
    .hero-credit { bottom: 24px; left: 24px; }
    .verified-badge {
      position: absolute;
      top: 32px;
      left: 28px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(6, 78, 59, 0.88);
      border: 1.5px solid #10B981;
      color: #ECFDF5;
      font-size: 18px;
      font-weight: 800;
      box-shadow: 0 10px 28px rgba(0,0,0,0.4);
    }
    .verified-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #34D399;
      box-shadow: 0 0 10px #34D399;
    }
    .hero-content {
      flex: 1;
      padding: 86px 76px 72px 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      text-align: right;
    }
    .hero-course-badge {
      padding: 10px 22px;
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.16);
      border: 1.5px solid rgba(45, 212, 191, 0.55);
      color: #5EEAD4;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 26px;
    }
    .hero-title-ar {
      font-size: 68px;
      font-weight: 900;
      line-height: 1.2;
      color: #FFFFFF;
      margin-bottom: 14px;
    }
    .hero-title-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 30px;
      font-weight: 700;
      color: #38BDF8;
      margin-bottom: 22px;
    }
    .hero-subtitle {
      font-size: 25px;
      font-weight: 600;
      color: #CBD5E1;
      line-height: 1.55;
      max-width: 900px;
      margin-bottom: 28px;
    }
    .species-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
      margin-bottom: 34px;
    }
    .species-pill {
      padding: 8px 18px;
      border-radius: 10px;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: #E2E8F0;
      font-size: 18px;
      font-weight: 700;
    }
    .hero-topics-box {
      width: 100%;
      padding: 24px 28px;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.22);
    }
    .hero-topics-label {
      font-size: 20px;
      font-weight: 800;
      color: #5EEAD4;
      margin-bottom: 14px;
    }
    .hero-topics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .hero-topic-chip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.72);
      font-size: 19px;
      font-weight: 700;
      color: #F1F5F9;
    }
    .hero-topic-idx {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: #0F172A;
      background: #2DD4BF;
      padding: 3px 9px;
      border-radius: 7px;
    }

    /* === TIMELINE & CYCLE === */
    .timeline-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .timeline-panel {
      padding: 24px 30px 20px;
      border-radius: 22px;
      background: rgba(15, 23, 42, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.22);
    }
    .timeline-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .tp-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 21px;
      font-weight: 800;
      color: #38BDF8;
    }
    .tp-ar {
      font-size: 25px;
      font-weight: 800;
      color: #F8FAFC;
    }
    .gestation-bar-wrap {
      display: flex;
      height: 112px;
      border-radius: 16px;
      overflow: hidden;
      border: 2px solid rgba(148, 163, 184, 0.25);
    }
    .gestation-seg {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 10px 18px;
      position: relative;
    }
    .gestation-seg.early {
      background: rgba(51, 65, 85, 0.65);
      border-right: 3px dashed rgba(255, 255, 255, 0.5);
      color: #CBD5E1;
    }
    .gestation-seg.focus {
      background: linear-gradient(135deg, rgba(13, 148, 136, 0.45) 0%, rgba(16, 185, 129, 0.3) 100%);
      color: #FFFFFF;
      box-shadow: inset 0 0 36px rgba(20, 184, 166, 0.3);
    }
    .seg-glow-pill {
      position: absolute;
      top: 8px;
      right: 16px;
      padding: 3px 12px;
      border-radius: 999px;
      background: #10B981;
      color: #052E16;
      font-size: 14px;
      font-weight: 800;
    }
    .seg-top {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 26px;
      font-weight: 800;
      margin-top: 8px;
    }
    .seg-sub {
      font-size: 19px;
      font-weight: 700;
      opacity: 0.92;
      margin-top: 2px;
    }
    .gestation-ticks {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #94A3B8;
    }
    .timeline-bottom {
      flex: 1;
      display: flex;
      gap: 26px;
      min-height: 0;
    }
    .diagram-stage {
      flex: 0 0 56%;
      border-radius: 22px;
      background: #FFFFFF;
      border: 2px solid rgba(148, 163, 184, 0.3);
      padding: 22px 24px 52px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .diagram-img {
      max-width: 100%;
      max-height: 410px;
      object-fit: contain;
    }
    .diagram-caption {
      position: absolute;
      bottom: 14px;
      right: 18px;
      padding: 5px 14px;
      border-radius: 8px;
      background: #0F172A;
      color: #5EEAD4;
      font-size: 16px;
      font-weight: 800;
    }
    .milestones-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
    }
    .milestone-card {
      flex: 1;
      padding: 20px 24px;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-right: 6px solid #14B8A6;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .milestone-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .milestone-title-ar {
      font-size: 24px;
      font-weight: 800;
      color: #F8FAFC;
    }
    .milestone-tag {
      padding: 4px 12px;
      border-radius: 8px;
      border: 1px solid;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
    }
    .milestone-desc {
      font-size: 19px;
      font-weight: 600;
      color: #CBD5E1;
      line-height: 1.5;
    }

    /* === CLINICAL PHOTO WITH CALLOUTS === */
    .clinical-layout {
      flex: 1;
      display: flex;
      gap: 28px;
      min-height: 0;
    }
    .photo-stage {
      flex: 1;
      border-radius: 22px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    }
    .photo-stage.light-plate { background: #FFFFFF; }
    .photo-stage.dark-plate { background: #0B1524; }
    .photo-fit-box {
      position: relative;
    }
    .callout-svg {
      position: absolute;
      inset: 0;
      overflow: visible;
      pointer-events: none;
    }
    .callout-pill {
      position: absolute;
      transform: translate(-50%, -50%);
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(7, 17, 30, 0.94);
      border: 2.5px solid #14B8A6;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
      white-space: nowrap;
    }
    .callout-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: #FFFFFF;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .callout-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #F8FAFC;
      line-height: 1.2;
    }
    .callout-ar {
      font-size: 15px;
      font-weight: 700;
      color: #FDE68A;
      line-height: 1.25;
      margin-top: 2px;
    }
    .kp-panel {
      width: 600px;
      flex-shrink: 0;
      border-radius: 22px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.22);
      padding: 24px 24px;
      display: flex;
      flex-direction: column;
    }
    .kp-panel-title {
      font-size: 25px;
      font-weight: 900;
      color: #5EEAD4;
      padding-bottom: 14px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }
    .kp-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
    }
    .kp-card {
      flex: 1;
      padding: 15px 18px;
      border-radius: 16px;
      background: rgba(30, 41, 59, 0.78);
      border-right: 5px solid #14B8A6;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .kp-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .kp-num {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      color: #FFFFFF;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kp-term {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 19px;
      font-weight: 800;
      color: #F8FAFC;
    }
    .kp-note {
      font-size: 18px;
      font-weight: 600;
      color: #CBD5E1;
      line-height: 1.45;
    }

    /* === SPLIT COMPARE === */
    .compare-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .compare-grid {
      flex: 1;
      display: flex;
      gap: 28px;
      position: relative;
      align-items: stretch;
    }
    .vs-badge {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #0F172A;
      border: 3px solid #38BDF8;
      color: #F8FAFC;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 24px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
    }
    .cmp-card {
      flex: 1;
      border-radius: 22px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-top: 7px solid #10B981;
      padding: 26px 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cmp-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }
    .cmp-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 34px;
      font-weight: 900;
    }
    .cmp-pron {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #94A3B8;
    }
    .cmp-ar {
      font-size: 30px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .cmp-photo-wrap {
      position: relative;
      height: 220px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .cmp-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 45%;
    }
    .cmp-photo-cap {
      position: absolute;
      bottom: 8px;
      right: 10px;
      padding: 4px 12px;
      border-radius: 8px;
      background: rgba(7, 17, 30, 0.86);
      color: #E2E8F0;
      font-size: 15px;
      font-weight: 700;
    }
    .cmp-points {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      gap: 12px;
    }
    .cmp-point {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 13px 16px;
      border-radius: 14px;
      background: rgba(30, 41, 59, 0.72);
    }
    .cmp-check {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      border: 1.5px solid;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .cmp-point-title {
      font-size: 21px;
      font-weight: 800;
      color: #F8FAFC;
    }
    .cmp-point-detail {
      font-size: 17px;
      font-weight: 600;
      color: #CBD5E1;
      margin-top: 3px;
    }
    .cmp-tags {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cmp-tag {
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid;
      background: rgba(15, 23, 42, 0.6);
      font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
      font-size: 15px;
      font-weight: 700;
    }
    .exam-pearl {
      padding: 15px 24px;
      border-radius: 16px;
      background: rgba(245, 158, 11, 0.14);
      border: 1.5px solid rgba(245, 158, 11, 0.48);
      color: #FEF3C7;
      font-size: 21px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pearl-icon {
      color: #FBBF24;
      font-weight: 900;
      white-space: nowrap;
    }

    /* === CLINICAL CASE STUDY === */
    .case-layout {
      flex: 1;
      display: flex;
      gap: 30px;
      min-height: 0;
    }
    .case-photos-col {
      flex: 0 0 46%;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .case-photo-card {
      flex: 1;
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      border: 2px solid rgba(148, 163, 184, 0.25);
      background: #0B1524;
    }
    .case-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .case-photo-overlay {
      position: absolute;
      bottom: 0;
      inset-inline: 0;
      padding: 14px 18px;
      background: linear-gradient(180deg, transparent 0%, rgba(7,17,30,0.92) 45%);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .case-photo-label-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 17px;
      font-weight: 800;
      color: #5EEAD4;
    }
    .case-photo-label-ar {
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .case-photo-credit {
      position: absolute;
      top: 10px;
      left: 12px;
      padding: 3px 10px;
      border-radius: 6px;
      background: rgba(7, 17, 30, 0.78);
      color: #CBD5E1;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
    }
    .case-details-col {
      flex: 1;
      border-radius: 22px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.24);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
    }
    .case-alert-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 18px;
      border-radius: 14px;
      background: rgba(245, 158, 11, 0.16);
      border: 1.5px solid rgba(245, 158, 11, 0.5);
    }
    .case-time {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 19px;
      font-weight: 900;
      color: #FBBF24;
    }
    .case-species {
      font-size: 21px;
      font-weight: 800;
      color: #FEF3C7;
    }
    .case-quote {
      font-size: 25px;
      font-weight: 700;
      line-height: 1.55;
      color: #F8FAFC;
      padding: 18px 22px;
      border-radius: 16px;
      background: rgba(30, 41, 59, 0.8);
      border-right: 6px solid #38BDF8;
    }
    .case-section-label {
      font-size: 21px;
      font-weight: 800;
      color: #5EEAD4;
    }
    .case-signs-list {
      display: flex;
      flex-direction: column;
      gap: 11px;
    }
    .case-sign-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 11px 16px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.65);
      font-size: 20px;
      font-weight: 700;
    }
    .case-sign-badge {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #0D9488;
      color: #FFFFFF;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .case-sign-ar { color: #F8FAFC; }
    .case-sign-en {
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #7DD3FC;
      font-size: 17px;
    }
    .case-verdict {
      padding: 18px 22px;
      border-radius: 16px;
      background: rgba(16, 185, 129, 0.14);
      border: 1.5px solid rgba(16, 185, 129, 0.45);
    }
    .verdict-title {
      font-size: 22px;
      font-weight: 900;
      color: #34D399;
      margin-bottom: 6px;
    }
    .verdict-body {
      font-size: 19px;
      font-weight: 600;
      color: #ECFDF5;
      line-height: 1.5;
    }

    /* === SUMMARY MIND MAP === */
    .summary-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .summary-top-banner {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 18px 28px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(13, 148, 136, 0.25), rgba(37, 99, 235, 0.2));
      border: 1.5px solid rgba(45, 212, 191, 0.4);
    }
    .summary-thumb {
      width: 140px;
      height: 100px;
      object-fit: cover;
      border-radius: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      flex-shrink: 0;
    }
    .summary-center-text { flex: 1; text-align: right; }
    .summary-kicker {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #5EEAD4;
      letter-spacing: 1px;
    }
    .summary-headline {
      font-size: 32px;
      font-weight: 900;
      color: #FFFFFF;
      margin-top: 4px;
    }
    .summary-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
    }
    .sum-card {
      padding: 22px 26px;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-top: 6px solid #14B8A6;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sum-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sum-badge {
      padding: 5px 14px;
      border-radius: 8px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 800;
    }
    .sum-title-ar {
      font-size: 25px;
      font-weight: 900;
      color: #F8FAFC;
    }
    .sum-bullets {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sum-bullets li {
      font-size: 20px;
      font-weight: 600;
      color: #CBD5E1;
      padding-right: 18px;
      position: relative;
      line-height: 1.4;
    }
    .sum-bullets li::before {
      content: '●';
      position: absolute;
      right: 0;
      color: #2DD4BF;
      font-size: 14px;
      top: 4px;
    }
    .summary-footer-note {
      padding: 14px 24px;
      border-radius: 14px;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(45, 212, 191, 0.3);
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      color: #5EEAD4;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="slide-inner">
      ${isHero ? '' : renderHeader(slide, slideIdx, totalSlides, deck)}
      <main class="slide-body">${bodyContent}</main>
      ${isHero ? '' : renderProgressBar(deck.chapters, chapterIdx)}
    </div>
  </div>
</body>
</html>`;
}
