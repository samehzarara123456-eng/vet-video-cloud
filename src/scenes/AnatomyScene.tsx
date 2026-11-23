import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AnatomySceneData, ImageDimension } from '../types';

interface AnatomySceneProps {
  scene: AnatomySceneData;
  imageDims?: Record<string, ImageDimension>;
}

export const AnatomyScene: React.FC<AnatomySceneProps> = ({ scene, imageDims }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentSec = frame / fps;

  const hasSidePanel = Boolean(scene.keyPoints && scene.keyPoints.length > 0);
  const headerHeight = 96;
  const padX = 44;
  const padBottom = 36;
  const gap = 28;
  const sidePanelWidth = hasSidePanel ? Math.round(width * 0.31) : 0;

  const stageOuterW = width - padX * 2 - (hasSidePanel ? sidePanelWidth + gap : 0);
  const stageOuterH = height - headerHeight - padBottom;
  const stageInnerW = stageOuterW - 36;
  const stageInnerH = stageOuterH - 44;

  // Compute exact displayed dimensions of the anatomical image so callouts hit exact coordinates
  const dims = imageDims?.[scene.image];
  let boxW = stageInnerW;
  let boxH = stageInnerH;
  if (dims && dims.width > 0 && dims.height > 0) {
    const ratio = Math.min(stageInnerW / dims.width, stageInnerH / dims.height);
    boxW = Math.round(dims.width * ratio);
    boxH = Math.round(dims.height * ratio);
  }

  // Smooth camera zoom / pan interpolation across focusSteps
  let zoomScale = 1;
  let focusX = 50;
  let focusY = 50;

  if (scene.focusSteps && scene.focusSteps.length > 0) {
    const steps = [...scene.focusSteps].sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0));
    let prev = { x: 50, y: 50, scale: 1, startSec: 0 };
    for (const step of steps) {
      const sSec = step.startSec ?? 0;
      if (currentSec >= sSec) {
        const progress = spring({
          frame: Math.max(0, frame - Math.round(sSec * fps)),
          fps,
          config: { damping: 20, stiffness: 65 },
        });
        focusX = interpolate(progress, [0, 1], [prev.x, step.x]);
        focusY = interpolate(progress, [0, 1], [prev.y, step.y]);
        zoomScale = interpolate(progress, [0, 1], [prev.scale, step.scale]);
        prev = { x: step.x, y: step.y, scale: step.scale, startSec: sSec };
      }
    }
  }

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const plateBg = scene.lightPlateBg !== false ? '#FFFFFF' : '#0F172A';

  return (
    <AbsoluteFill style={{ padding: `24px ${padX}px ${padBottom}px` }}>
      {/* Top Clinical Header */}
      <div
        style={{
          height: headerHeight - 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          opacity: interpolate(headerIn, [0, 1], [0, 1]),
        }}
      >
        <div
          dir="ltr"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 16px',
            borderRadius: 10,
            background: 'rgba(20, 184, 166, 0.16)',
            border: '1px solid rgba(20, 184, 166, 0.45)',
            color: '#5EEAD4',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          <span>{scene.sectionLabel}</span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            dir="rtl"
            style={{
              fontFamily: "'Cairo', sans-serif",
              fontSize: 30,
              fontWeight: 800,
              color: '#F8FAFC',
              lineHeight: 1.15,
            }}
          >
            {scene.titleAr}
          </div>
          {scene.titleEn ? (
            <div
              dir="ltr"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: '#94A3B8',
                marginTop: 2,
              }}
            >
              {scene.titleEn}
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content Area: Anatomical Plate + Optional Key Points Side Panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap,
          height: stageOuterH,
        }}
      >
        {/* Anatomical Plate Stage */}
        <div
          style={{
            width: stageOuterW,
            height: stageOuterH,
            borderRadius: 20,
            background: plateBg,
            border: '2px solid rgba(148, 163, 184, 0.28)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Zoomable Camera Wrapper */}
          <div
            style={{
              width: boxW,
              height: boxH,
              position: 'relative',
              transformOrigin: `${focusX}% ${focusY}%`,
              transform: `scale(${zoomScale})`,
            }}
          >
            <Img
              src={staticFile(`lecture/images/${scene.image}`)}
              style={{
                width: boxW,
                height: boxH,
                objectFit: 'contain',
                display: 'block',
              }}
            />

            {/* Coordinate-Calibrated Animated Callout Arrows & Spotlight Rings */}
            {scene.callouts && scene.callouts.length > 0 ? (
              <svg
                width={boxW}
                height={boxH}
                viewBox={`0 0 ${boxW} ${boxH}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                {scene.callouts.map((c) => {
                  const startFrame = Math.round(c.startSec * fps);
                  if (frame < startFrame) return null;

                  const localFrame = frame - startFrame;
                  const anim = spring({
                    frame: localFrame,
                    fps,
                    config: { damping: 16, stiffness: 120 },
                  });
                  const isDimmed = c.endSec !== undefined && currentSec > c.endSec;
                  const opacity = isDimmed ? 0.42 : interpolate(anim, [0, 1], [0, 1]);
                  const color = c.color || '#EA580C';

                  const tx = (c.targetX / 100) * boxW;
                  const ty = (c.targetY / 100) * boxH;
                  const lx = (c.labelX / 100) * boxW;
                  const ly = (c.labelY / 100) * boxH;

                  const dx = tx - lx;
                  const dy = ty - ly;
                  const dist = Math.hypot(dx, dy) || 1;
                  const curX = lx + dx * anim;
                  const curY = ly + dy * anim;

                  // Pulse ring around exact anatomical landmark
                  const pulse = (localFrame % 36) / 36;
                  const pulseRadius = 9 + pulse * 14;
                  const pulseOpacity = (1 - pulse) * 0.75 * opacity;

                  // Arrowhead triangle geometry
                  const angle = Math.atan2(dy, dx);
                  const headLen = 13 / Math.sqrt(zoomScale);
                  const ax1 = curX - headLen * Math.cos(angle - Math.PI / 6);
                  const ay1 = curY - headLen * Math.sin(angle - Math.PI / 6);
                  const ax2 = curX - headLen * Math.cos(angle + Math.PI / 6);
                  const ay2 = curY - headLen * Math.sin(angle + Math.PI / 6);

                  return (
                    <g key={c.id} opacity={opacity}>
                      {/* Contrast outline underneath arrow for readability on any anatomical image */}
                      <line
                        x1={lx}
                        y1={ly}
                        x2={curX}
                        y2={curY}
                        stroke="#FFFFFF"
                        strokeWidth={6 / Math.sqrt(zoomScale)}
                        strokeLinecap="round"
                        opacity={0.92}
                      />
                      <line
                        x1={lx}
                        y1={ly}
                        x2={curX}
                        y2={curY}
                        stroke={color}
                        strokeWidth={3.4 / Math.sqrt(zoomScale)}
                        strokeLinecap="round"
                      />
                      {dist > 12 ? (
                        <polygon
                          points={`${curX},${curY} ${ax1},${ay1} ${ax2},${ay2}`}
                          fill={color}
                          stroke="#FFFFFF"
                          strokeWidth={1.2 / Math.sqrt(zoomScale)}
                        />
                      ) : null}

                      {/* Target Pin + Pulse */}
                      <circle
                        cx={tx}
                        cy={ty}
                        r={pulseRadius / Math.sqrt(zoomScale)}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.5 / Math.sqrt(zoomScale)}
                        opacity={pulseOpacity}
                      />
                      <circle
                        cx={tx}
                        cy={ty}
                        r={5.5 / Math.sqrt(zoomScale)}
                        fill={color}
                        stroke="#FFFFFF"
                        strokeWidth={2.2 / Math.sqrt(zoomScale)}
                      />
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {/* Crisp Anatomical Callout Label Pills */}
            {scene.callouts?.map((c) => {
              const startFrame = Math.round(c.startSec * fps);
              if (frame < startFrame) return null;

              const anim = spring({
                frame: frame - startFrame,
                fps,
                config: { damping: 16, stiffness: 130 },
              });
              const isDimmed = c.endSec !== undefined && currentSec > c.endSec;
              const color = c.color || '#EA580C';

              return (
                <div
                  key={`${c.id}-pill`}
                  style={{
                    position: 'absolute',
                    left: `${c.labelX}%`,
                    top: `${c.labelY}%`,
                    transform: `translate(-50%, -50%) scale(${interpolate(anim, [0, 1], [0.75, 1]) / Math.sqrt(zoomScale)})`,
                    opacity: isDimmed ? 0.5 : interpolate(anim, [0, 1], [0, 1]),
                    background: 'rgba(15, 23, 42, 0.94)',
                    border: `2px solid ${color}`,
                    borderRadius: 10,
                    padding: '6px 12px',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}
                >
                  <div
                    dir="ltr"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#F8FAFC',
                      lineHeight: 1.2,
                    }}
                  >
                    {c.label}
                  </div>
                  {c.sublabel ? (
                    <div
                      dir="rtl"
                      style={{
                        fontFamily: "'Cairo', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#FDBA74',
                        marginTop: 2,
                      }}
                    >
                      {c.sublabel}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Subtle Anatomical Source Attribution */}
          {scene.imageCredit ? (
            <div
              dir="ltr"
              style={{
                position: 'absolute',
                bottom: 10,
                left: 14,
                padding: '3px 10px',
                borderRadius: 6,
                background: 'rgba(15, 23, 42, 0.78)',
                color: '#CBD5E1',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Source: {scene.imageCredit}
            </div>
          ) : null}
        </div>

        {/* Right Side Panel: Structured Veterinary Key Points */}
        {hasSidePanel ? (
          <div
            style={{
              width: sidePanelWidth,
              height: stageOuterH,
              borderRadius: 20,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.22)',
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflow: 'hidden',
            }}
          >
            <div
              dir="rtl"
              style={{
                fontFamily: "'Cairo', sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: '#5EEAD4',
                borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                paddingBottom: 10,
              }}
            >
              النقاط التشريحية الأساسية
            </div>

            {scene.keyPoints?.map((kp, idx) => {
              const sFrame = Math.round((kp.startSec ?? idx * 1.2) * fps);
              const kpAnim = spring({
                frame: Math.max(0, frame - sFrame),
                fps,
                config: { damping: 16, stiffness: 120 },
              });
              const visible = frame >= sFrame;

              return (
                <div
                  key={`${kp.term}-${idx}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(30, 41, 59, 0.85)',
                    borderRight: '4px solid #14B8A6',
                    opacity: visible ? interpolate(kpAnim, [0, 1], [0, 1]) : 0,
                    transform: `translateX(${visible ? interpolate(kpAnim, [0, 1], [18, 0]) : 18}px)`,
                  }}
                >
                  <div
                    dir="ltr"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#F8FAFC',
                      textAlign: 'left',
                    }}
                  >
                    {kp.term}
                  </div>
                  {kp.note ? (
                    <div
                      dir="rtl"
                      style={{
                        fontFamily: "'Cairo', sans-serif",
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#CBD5E1',
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      {kp.note}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
