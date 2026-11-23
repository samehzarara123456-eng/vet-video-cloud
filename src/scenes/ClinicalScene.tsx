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
import { ClinicalSceneData } from '../types';

export const ClinicalScene: React.FC<{ scene: ClinicalSceneData }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const accentMap = {
    pearl: '#14B8A6',
    info: '#38BDF8',
    warning: '#F59E0B',
  };
  const accent = accentMap[scene.severity || 'pearl'];

  return (
    <AbsoluteFill style={{ padding: '32px 54px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          dir="ltr"
          style={{
            padding: '8px 18px',
            borderRadius: 999,
            background: `${accent}24`,
            border: `1.5px solid ${accent}`,
            color: accent,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 17,
            fontWeight: 800,
          }}
        >
          {scene.badge}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            dir="rtl"
            style={{
              fontFamily: "'Cairo', sans-serif",
              fontSize: 34,
              fontWeight: 800,
              color: '#F8FAFC',
            }}
          >
            {scene.titleAr}
          </div>
          {scene.titleEn ? (
            <div
              dir="ltr"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 17,
                fontWeight: 600,
                color: '#94A3B8',
              }}
            >
              {scene.titleEn}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 30, alignItems: 'stretch' }}>
        {scene.image ? (
          <div
            style={{
              flex: '0 0 42%',
              borderRadius: 20,
              background: '#FFFFFF',
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: `2px solid ${accent}66`,
            }}
          >
            <Img
              src={staticFile(`lecture/images/${scene.image}`)}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
            {scene.imageCredit ? (
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 12,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: 'rgba(15,23,42,0.8)',
                  color: '#CBD5E1',
                  fontSize: 11,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {scene.imageCredit}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {scene.bullets.map((b, idx) => {
            const sFrame = Math.round((b.startSec ?? idx * 1.1) * fps);
            const anim = spring({
              frame: Math.max(0, frame - sFrame),
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            const shown = frame >= sFrame;

            return (
              <div
                key={`${b.heading}-${idx}`}
                style={{
                  padding: '18px 22px',
                  borderRadius: 16,
                  background: 'rgba(15, 23, 42, 0.9)',
                  borderRight: `5px solid ${accent}`,
                  borderTop: '1px solid rgba(148,163,184,0.18)',
                  borderLeft: '1px solid rgba(148,163,184,0.18)',
                  borderBottom: '1px solid rgba(148,163,184,0.18)',
                  opacity: shown ? interpolate(anim, [0, 1], [0, 1]) : 0,
                  transform: `translateX(${shown ? interpolate(anim, [0, 1], [24, 0]) : 24}px)`,
                }}
              >
                <div
                  dir="rtl"
                  style={{
                    fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#F8FAFC',
                    marginBottom: 6,
                  }}
                >
                  {b.heading}
                </div>
                <div
                  dir="rtl"
                  style={{
                    fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif",
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#CBD5E1',
                    lineHeight: 1.5,
                  }}
                >
                  {b.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
