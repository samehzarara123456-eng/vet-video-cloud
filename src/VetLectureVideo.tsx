import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { FontLoader } from './components/FontLoader';
import { AnatomyScene } from './scenes/AnatomyScene';
import { ClinicalScene } from './scenes/ClinicalScene';
import { ComparisonScene } from './scenes/ComparisonScene';
import { MindMapScene } from './scenes/MindMapScene';
import { TitleScene } from './scenes/TitleScene';
import { LectureManifest, SceneData } from './types';

export type VetLectureVideoProps = {
  manifest: LectureManifest;
};

const SceneTransitionWrapper: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeFrames = Math.min(10, Math.floor(durationInFrames / 5));

  const opacity = interpolate(
    frame,
    [0, fadeFrames, Math.max(fadeFrames + 1, durationInFrames - fadeFrames), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const renderScene = (scene: SceneData, manifest: LectureManifest) => {
  switch (scene.type) {
    case 'title':
      return <TitleScene scene={scene} />;
    case 'anatomy':
      return <AnatomyScene scene={scene} imageDims={manifest.imageDims} />;
    case 'comparison':
      return <ComparisonScene scene={scene} />;
    case 'clinical':
      return <ClinicalScene scene={scene} />;
    case 'mindmap':
      return <MindMapScene scene={scene} />;
    default:
      return null;
  }
};

export const VetLectureVideo: React.FC<VetLectureVideoProps> = ({ manifest }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  let offset = 0;
  const scheduled = manifest.scenes.map((scene, index) => {
    const dur = Math.max(15, Math.round(scene.durationSec * fps));
    const item = { scene, from: offset, dur, key: `${scene.type}-${index}` };
    offset += dur;
    return item;
  });

  const progressPct = Math.min(100, (frame / Math.max(1, durationInFrames - 1)) * 100);

  return (
    <FontLoader>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 20% 18%, #13253F 0%, #0B1220 55%, #070B14 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Clinical Background Grid */}
        <AbsoluteFill
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* Lecture Narration Audio (from uploaded WAV/MP3 or Cloud TTS) */}
        {manifest.audioFile ? (
          <Audio src={staticFile(`lecture/${manifest.audioFile}`)} />
        ) : null}

        {/* Scenes */}
        {scheduled.map((item) => (
          <Sequence key={item.key} from={item.from} durationInFrames={item.dur}>
            <SceneTransitionWrapper durationInFrames={item.dur}>
              {renderScene(item.scene, manifest)}
            </SceneTransitionWrapper>
          </Sequence>
        ))}

        {/* Ultra-clean Bottom Lecture Progress Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: 'rgba(148, 163, 184, 0.15)',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #14B8A6, #38BDF8)',
            }}
          />
        </div>
      </AbsoluteFill>
    </FontLoader>
  );
};
