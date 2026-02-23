import React from 'react';

interface CustomTreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  name?: string;
  roiPercent?: number;
  id?: string;
  onCardClick?: (id: string) => void;
}

const CustomTreemapContent: React.FC<CustomTreemapContentProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  color = '#ccc',
  name = '',
  roiPercent = 0,
  id = '',
  onCardClick,
}) => {
  const showLabel = width > 60 && height > 40;
  const showRoi = width > 60 && height > 55;

  return (
    <g
      onClick={() => id && onCardClick?.(id)}
      style={{ cursor: id ? 'pointer' : 'default' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        rx={3}
        ry={3}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showRoi ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={Math.min(12, width / 10)}
          fontWeight={600}
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
          {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '...' : name}
        </text>
      )}
      {showRoi && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={Math.min(11, width / 12)}
          fontWeight={500}
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
          {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
        </text>
      )}
    </g>
  );
};

export default CustomTreemapContent;
