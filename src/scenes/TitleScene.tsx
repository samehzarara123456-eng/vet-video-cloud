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
import { TitleSceneData } from '../types';

export const TitleScene: React.FC<{ scene: TitleSceneData }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = scene.accentColor || '#14B8A6';

  const badgeIn = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const titleIn = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 100 } });
  const enIn = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 100 } });
  const imageIn = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 90 } });
  const barWidth = interpolate(frame, [10, 40], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const hasImage = Boolean(scene.image);

  return (
    <AbsoluteFill
      style={{
        padding: '56px 68px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 44,
      }}
    >
      {/* Left/Optional Hero Anatomical Plate */}
      {hasImage && scene.image ? (
        <div
          style={{
            flex: '0 0 43%',
            height: 520,
            background: '#FFFFFF',
            borderRadius: 24,
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            border: `2px solid ${accent}55`,
            opacity: interpolate(imageIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(imageIn, [0, 1], [28, 0])}px) scale(${interpolate(imageIn, [0, 1], [0.94, 1])})`,
          }}
        >
          <Img
            src={staticFile(`lecture/images/${scene.image}`)}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 12,
            }}
          />
        </div>
      ) : null}

      {/* Right / Main Title Column (Arabic RTL + Latin Subtitle) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: hasImage ? 'flex-end' : 'center',
          textAlign: hasImage ? 'right' : 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 22px',
            borderRadius: 999,
            background: `${accent}22`,
            border: `1.5px solid ${accent}88`,
            color: '#5EEAD4',
            fontFamily: "'Plus Jakarta Sans', 'Cairo', sans-serif",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 0.4,
            opacity: interpolate(badgeIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(badgeIn, [0, 1], [-16, 0])}px)`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 12px ${accent}`,
            }}
          />
          <span>{scene.courseBadge}</span>
        </div>

        <h1
          dir="rtl"
          style={{
            margin: 0,
            fontFamily: "'Cairo', sans-serif",
            fontSize: hasImage ? 54 : 64,
            fontWeight: 900,
            lineHeight: 1.24,
            color: '#F8FAFC',
            textShadow: '0 6px 24px rgba(0,0,0,0.4)',
            opacity: interpolate(titleIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0])}px)`,
          }}
        >
          {scene.titleAr}
        </h1>

        <div
          dir="ltr"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: hasImage ? 26 : 30,
            fontWeight: 700,
            color: '#94A3B8',
            letterSpacing: 0.3,
            opacity: interpolate(enIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(enIn, [0, 1], [16, 0])}px)`,
          }}
        >
          {scene.titleEn}
        </div>

        <div
          style={{
            width: hasImage ? 240 : 320,
            height: 4,
            borderRadius: 99,
            background: 'rgba(148,163,184,0.2)',
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${accent}, #38BDF8)`,
            }}
          />
        </div>

        {scene.subtitle ? (
          <p
            dir="rtl"
            style={{
              margin: '6px 0 0 0',
              fontFamily: "'Cairo', sans-serif",
              fontSize: 24,
              fontWeight: 600,
              color: '#CBD5E1',
              maxWidth: 680,
              lineHeight: 1.5,
              opacity: interpolate(enIn, [0, 1], [0, 1]),
            }}
          >
            {scene.subtitle}
          </p>
        ) : null}

        {scene.species && scene.species.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 12,
              justifyContent: hasImage ? 'flex-end' : 'center',
            }}
          >
            {scene.species.map((sp, i) => {
              const chipIn = spring({
                frame: frame - 20 - i * 4,
                fps,
                config: { damping: 15, stiffness: 130 },
              });
              return (
                <div
                  key={sp}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 12,
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#E2E8F0',
                    fontFamily: "'Plus Jakarta Sans', 'Cairo', sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    opacity: interpolate(chipIn, [0, 1], [0, 1]),
                    transform: `scale(${interpolate(chipIn, [0, 1], [0.85, 1])})`,
                  }}
                >
                  {sp}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
