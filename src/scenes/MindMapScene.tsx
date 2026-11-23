import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { MindMapSceneData } from '../types';

export const MindMapScene: React.FC<{ scene: MindMapSceneData }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const headerH = 92;
  const canvasW = width - 80;
  const canvasH = height - headerH - 40;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const centerAnim = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const branches = scene.branches;
  const half = Math.ceil(branches.length / 2);
  const leftBranches = branches.slice(0, half);
  const rightBranches = branches.slice(half);

  const renderSide = (list: typeof branches, side: 'left' | 'right', indexOffset: number) => {
    const count = list.length;
    return list.map((branch, idx) => {
      const globalIdx = indexOffset + idx;
      const startFrame = Math.round((branch.startSec ?? 0.5 + globalIdx * 0.7) * fps);
      const anim = spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 16, stiffness: 110 },
      });
      const visible = frame >= startFrame;

      const spacingY = canvasH / (count + 1);
      const by = spacingY * (idx + 1);
      const bx = side === 'left' ? cx - 260 : cx + 260;
      const childAnchorX = side === 'left' ? bx - 170 : bx + 170;

      // Smooth cubic bezier from center node to branch node
      const startX = side === 'left' ? cx - 108 : cx + 108;
      const ctrl1X = side === 'left' ? cx - 175 : cx + 175;
      const ctrl2X = side === 'left' ? bx + 75 : bx - 75;
      const endX = side === 'left' ? bx + 84 : bx - 84;
      const pathD = `M ${startX} ${cy} C ${ctrl1X} ${cy}, ${ctrl2X} ${by}, ${endX} ${by}`;

      return (
        <g key={branch.id} opacity={visible ? interpolate(anim, [0, 1], [0, 1]) : 0}>
          {/* Main branch curved connector */}
          <path
            d={pathD}
            fill="none"
            stroke={branch.color}
            strokeWidth={3.5}
            strokeDasharray={500}
            strokeDashoffset={interpolate(anim, [0, 1], [500, 0])}
            strokeLinecap="round"
          />

          {/* Child keyword leaves */}
          {branch.children.map((child, cIdx) => {
            const cFrame = startFrame + 8 + cIdx * 5;
            const cAnim = spring({
              frame: Math.max(0, frame - cFrame),
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            const cVisible = frame >= cFrame;
            const spread = Math.min(50, (spacingY - 12) / Math.max(1, branch.children.length));
            const offsetFromCenter = (cIdx - (branch.children.length - 1) / 2) * spread;
            const cyLeaf = by + offsetFromCenter;
            const bEdgeX = side === 'left' ? bx - 84 : bx + 84;
            const cEdgeX = side === 'left' ? childAnchorX + 78 : childAnchorX - 78;

            return (
              <g key={`${branch.id}-${cIdx}`} opacity={cVisible ? interpolate(cAnim, [0, 1], [0, 1]) : 0}>
                <path
                  d={`M ${bEdgeX} ${by} C ${(bEdgeX + cEdgeX) / 2} ${by}, ${(bEdgeX + cEdgeX) / 2} ${cyLeaf}, ${cEdgeX} ${cyLeaf}`}
                  fill="none"
                  stroke={`${branch.color}AA`}
                  strokeWidth={2}
                />
                <rect
                  x={childAnchorX - 84}
                  y={cyLeaf - 17}
                  width={168}
                  height={34}
                  rx={10}
                  fill="rgba(15, 23, 42, 0.94)"
                  stroke={`${branch.color}99`}
                  strokeWidth={1.6}
                />
                <text
                  x={childAnchorX}
                  y={cyLeaf + 5}
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  fontSize={14}
                  fontWeight={700}
                >
                  {child}
                </text>
              </g>
            );
          })}

          {/* Primary Branch Node */}
          <rect
            x={bx - 88}
            y={by - 23}
            width={176}
            height={46}
            rx={13}
            fill={branch.color}
          />
          <text
            x={bx}
            y={by + 6}
            textAnchor="middle"
            fill="#0B1220"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontSize={16}
            fontWeight={800}
          >
            {branch.label}
          </text>
        </g>
      );
    });
  };

  return (
    <AbsoluteFill style={{ padding: '24px 40px 30px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          height: headerH - 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          dir="ltr"
          style={{
            padding: '7px 16px',
            borderRadius: 10,
            background: 'rgba(167, 139, 250, 0.16)',
            border: '1px solid rgba(167, 139, 250, 0.45)',
            color: '#C4B5FD',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {scene.sectionLabel}
        </div>
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
      </div>

      {/* Animated SVG Mind Map Stage */}
      <div
        style={{
          flex: 1,
          borderRadius: 22,
          background: 'rgba(15, 23, 42, 0.72)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`}>
          {renderSide(leftBranches, 'left', 0)}
          {renderSide(rightBranches, 'right', leftBranches.length)}

          {/* Central Topic Hub */}
          <g
            transform={`translate(${cx}, ${cy}) scale(${interpolate(centerAnim, [0, 1], [0.7, 1])})`}
            opacity={interpolate(centerAnim, [0, 1], [0, 1])}
          >
            <rect
              x={-114}
              y={-44}
              width={228}
              height={88}
              rx={22}
              fill="#0F172A"
              stroke="#14B8A6"
              strokeWidth={3.5}
            />
            <text
              x={0}
              y={scene.centerSublabel ? -4 : 6}
              textAnchor="middle"
              fill="#F8FAFC"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              fontSize={20}
              fontWeight={800}
            >
              {scene.centerLabel}
            </text>
            {scene.centerSublabel ? (
              <text
                x={0}
                y={22}
                textAnchor="middle"
                fill="#5EEAD4"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontSize={14}
                fontWeight={600}
              >
                {scene.centerSublabel}
              </text>
            ) : null}
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
