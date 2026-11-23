import React from 'react';
import { Composition } from 'remotion';
import { VetLectureVideo, VetLectureVideoProps } from './VetLectureVideo';
import { LectureManifest } from './types';

const DEFAULT_MANIFEST: LectureManifest = {
  id: 'preview',
  title: 'Veterinary Anatomy Lecture',
  fps: 30,
  width: 1280,
  height: 720,
  scenes: [
    {
      type: 'title',
      durationSec: 4,
      courseBadge: 'Veterinary Anatomy — الطب البيطري',
      titleAr: 'تشريح الأجهزة الحيوية في الحيوانات المستأنسة',
      titleEn: 'Comparative Veterinary Anatomy',
      species: ['Equine', 'Bovine', 'Canine'],
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VetLecture"
      component={VetLectureVideo}
      durationInFrames={120}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{ manifest: DEFAULT_MANIFEST } as VetLectureVideoProps}
      calculateMetadata={({ props }) => {
        const manifest = props.manifest || DEFAULT_MANIFEST;
        const fps = manifest.fps || 30;
        const width = manifest.width || 1280;
        const height = manifest.height || 720;
        const totalSec = manifest.scenes.reduce((acc, s) => acc + Math.max(1, s.durationSec), 0);
        return {
          fps,
          width,
          height,
          durationInFrames: Math.max(30, Math.round(totalSec * fps)),
        };
      }}
    />
  );
};
