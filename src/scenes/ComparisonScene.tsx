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
import { ComparisonSceneData } from '../types';

const DEFAULT_COLORS = ['#14B8A6', '#38BDF8', '#F97316', '#A78BFA'];

export const ComparisonScene: React.FC<{ scene: ComparisonSceneData }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ padding: '28px 48px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          dir="ltr"
          style={{
            padding: '7px 16px',
            borderRadius: 10,
            background: 'rgba(56, 189, 248, 0.16)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            color: '#7DD3FC',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {scene.sectionLabel}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            dir="rtl"
            style={{
              fontFamily: "'Cairo', sans-serif",
              fontSize: 32,
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
                fontSize: 16,
                fontWeight: 600,
                color: '#94A3B8',
              }}
            >
              {scene.titleEn}
            </div>
          ) : null}
        </div>
      </div>

      {/* Species Columns */}
      <div style={{ flex: 1, display: 'flex', gap: 24 }}>
        {scene.columns.map((col, colIdx) => {
          const colColor = col.badgeColor || DEFAULT_COLORS[colIdx % DEFAULT_COLORS.length];
          const cardIn = spring({
            frame: frame - colIdx * 8,
            fps,
            config: { damping: 16, stiffness: 110 },
          });

          return (
            <div
              key={col.species}
              style={{
                flex: 1,
                borderRadius: 20,
                background: 'rgba(15, 23, 42, 0.88)',
                border: `2px solid ${colColor}66`,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: interpolate(cardIn, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px)`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: `2px solid ${colColor}55`,
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: colColor,
                  }}
                >
                  {col.species}
                </span>
                {col.speciesAr ? (
                  <span
                    dir="rtl"
                    style={{
                      fontFamily: "'Cairo', sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#F8FAFC',
                    }}
                  >
                    {col.speciesAr}
                  </span>
                ) : null}
              </div>

              {col.image ? (
                <div
                  style={{
                    height: 150,
                    borderRadius: 12,
                    background: '#FFFFFF',
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Img
                    src={staticFile(`lecture/images/${col.image}`)}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.points.map((pt, pIdx) => {
                  const ptIn = spring({
                    frame: frame - (colIdx * 8 + 12 + pIdx * 7),
                    fps,
                    config: { damping: 16, stiffness: 120 },
                  });
                  return (
                    <div
                      key={`${col.species}-${pIdx}`}
                      dir="rtl"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(30, 41, 59, 0.85)',
                        color: '#E2E8F0',
                        fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif",
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        opacity: interpolate(ptIn, [0, 1], [0, 1]),
                        transform: `translateY(${interpolate(ptIn, [0, 1], [10, 0])}px)`,
                      }}
                    >
                      • {pt}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
