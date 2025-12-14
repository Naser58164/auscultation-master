import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SoundSystem, AnatomicalLocation, LUNG_LOCATIONS, HEART_LOCATIONS, BOWEL_LOCATIONS } from '@/types/database';

interface BodyDiagramProps {
  selectedLocation: string | null;
  onLocationSelect: (locationId: string) => void;
  activeSystems?: SoundSystem[];
  highlightedLocation?: string | null;
  showLabels?: boolean;
  mode?: 'select' | 'display';
}

export function BodyDiagram({
  selectedLocation,
  onLocationSelect,
  activeSystems = ['lung', 'heart', 'bowel'],
  highlightedLocation,
  showLabels = true,
  mode = 'select',
}: BodyDiagramProps) {
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);

  const getLocationColor = (location: AnatomicalLocation, isSelected: boolean, isHovered: boolean) => {
    const baseColors = {
      lung: {
        fill: isSelected ? 'fill-lung' : isHovered ? 'fill-lung/60' : 'fill-lung/30',
        stroke: 'stroke-lung',
      },
      heart: {
        fill: isSelected ? 'fill-heart' : isHovered ? 'fill-heart/60' : 'fill-heart/30',
        stroke: 'stroke-heart',
      },
      bowel: {
        fill: isSelected ? 'fill-bowel' : isHovered ? 'fill-bowel/60' : 'fill-bowel/30',
        stroke: 'stroke-bowel',
      },
    };

    return baseColors[location.system];
  };

  const renderLocation = (location: AnatomicalLocation) => {
    if (!activeSystems.includes(location.system)) return null;

    const isSelected = selectedLocation === location.id;
    const isHovered = hoveredLocation === location.id;
    const isHighlighted = highlightedLocation === location.id;
    const colors = getLocationColor(location, isSelected || isHighlighted, isHovered);

    return (
      <g
        key={location.id}
        className={cn(
          'cursor-pointer transition-all duration-200',
          mode === 'select' && 'hover:scale-110'
        )}
        onClick={() => mode === 'select' && onLocationSelect(location.id)}
        onMouseEnter={() => setHoveredLocation(location.id)}
        onMouseLeave={() => setHoveredLocation(null)}
      >
        {/* Outer ring for highlighted/selected */}
        {(isSelected || isHighlighted) && (
          <circle
            cx={location.x}
            cy={location.y}
            r="4.5"
            className={cn(
              'fill-none stroke-2 animate-pulse-ring',
              colors.stroke
            )}
          />
        )}
        
        {/* Main dot */}
        <circle
          cx={location.x}
          cy={location.y}
          r="3"
          className={cn(
            'stroke-2 transition-all duration-200',
            colors.fill,
            colors.stroke
          )}
        />

        {/* Label */}
        {showLabels && (isHovered || isSelected) && (
          <g>
            <rect
              x={location.x + 5}
              y={location.y - 8}
              width={location.name.length * 2.5 + 6}
              height="10"
              rx="2"
              className="fill-background stroke-border"
            />
            <text
              x={location.x + 8}
              y={location.y}
              className="fill-foreground text-[3px] font-medium"
            >
              {location.name}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-auto"
        style={{ aspectRatio: '1' }}
      >
        {/* Body Outline - Anterior View */}
        <g className="body-outline">
          {/* Head */}
          <ellipse
            cx="50"
            cy="8"
            rx="8"
            ry="7"
            className="fill-muted stroke-border stroke-1"
          />
          
          {/* Neck */}
          <rect
            x="47"
            y="14"
            width="6"
            height="4"
            className="fill-muted stroke-border stroke-1"
          />
          
          {/* Torso */}
          <path
            d="M 30 18 
               Q 28 25 28 35
               Q 28 55 32 70
               Q 34 80 40 85
               L 60 85
               Q 66 80 68 70
               Q 72 55 72 35
               Q 72 25 70 18
               Q 60 16 50 16
               Q 40 16 30 18
               Z"
            className="fill-muted stroke-border stroke-1"
          />

          {/* Shoulders */}
          <path
            d="M 30 18 Q 22 20 18 28 Q 16 32 16 38 L 28 35"
            className="fill-muted stroke-border stroke-1"
          />
          <path
            d="M 70 18 Q 78 20 82 28 Q 84 32 84 38 L 72 35"
            className="fill-muted stroke-border stroke-1"
          />

          {/* Reference Lines */}
          <line x1="50" y1="18" x2="50" y2="85" className="stroke-border/30 stroke-[0.5]" strokeDasharray="2,2" />
          <line x1="28" y1="45" x2="72" y2="45" className="stroke-border/30 stroke-[0.5]" strokeDasharray="2,2" />
          <line x1="28" y1="60" x2="72" y2="60" className="stroke-border/30 stroke-[0.5]" strokeDasharray="2,2" />
        </g>

        {/* Auscultation Points */}
        {LUNG_LOCATIONS.map(renderLocation)}
        {HEART_LOCATIONS.map(renderLocation)}
        {BOWEL_LOCATIONS.map(renderLocation)}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs">
        {activeSystems.includes('lung') && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-lung" />
            <span className="text-muted-foreground">Lungs</span>
          </div>
        )}
        {activeSystems.includes('heart') && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-heart" />
            <span className="text-muted-foreground">Heart</span>
          </div>
        )}
        {activeSystems.includes('bowel') && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-bowel" />
            <span className="text-muted-foreground">Bowel</span>
          </div>
        )}
      </div>
    </div>
  );
}
