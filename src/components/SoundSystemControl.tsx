import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Volume2, Loader2 } from 'lucide-react';
import { SoundSystem, Sound, LUNG_SOUNDS, HEART_SOUNDS, BOWEL_SOUNDS, ALL_LOCATIONS } from '@/types/database';

interface SoundSystemControlProps {
  system: SoundSystem;
  sounds: Sound[];
  isActive: boolean;
  isSessionActive: boolean;
  onPlay: (system: SoundSystem, soundCode: string, location: string, volume: number) => Promise<void>;
  onStop: (system: SoundSystem) => Promise<void>;
  onPreview: (soundCode: string) => void;
}

const SYSTEM_CONFIG = {
  lung: {
    icon: '🫁',
    label: 'Lungs',
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
    locations: ALL_LOCATIONS.filter(l => l.system === 'lung'),
    sounds: LUNG_SOUNDS,
  },
  heart: {
    icon: '❤️',
    label: 'Heart',
    color: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    locations: ALL_LOCATIONS.filter(l => l.system === 'heart'),
    sounds: HEART_SOUNDS,
  },
  bowel: {
    icon: '🔊',
    label: 'Bowel',
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    locations: ALL_LOCATIONS.filter(l => l.system === 'bowel'),
    sounds: BOWEL_SOUNDS,
  },
};

export function SoundSystemControl({
  system,
  sounds,
  isActive,
  isSessionActive,
  onPlay,
  onStop,
  onPreview,
}: SoundSystemControlProps) {
  const [selectedSound, setSelectedSound] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [volume, setVolume] = useState([5]);
  const [sending, setSending] = useState(false);

  const config = SYSTEM_CONFIG[system];

  const handlePlay = async () => {
    if (!selectedSound || !selectedLocation) return;
    setSending(true);
    try {
      await onPlay(system, selectedSound, selectedLocation, volume[0]);
    } finally {
      setSending(false);
    }
  };

  const handleStop = async () => {
    setSending(true);
    try {
      await onStop(system);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={`border-2 ${isActive ? config.color : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-xl">{config.icon}</span>
            {config.label}
          </CardTitle>
          {isActive && (
            <Badge variant="default" className="animate-pulse">
              Playing
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Sound</Label>
          <Select value={selectedSound} onValueChange={setSelectedSound}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select sound..." />
            </SelectTrigger>
            <SelectContent>
              {config.sounds.map((sound) => (
                <SelectItem key={sound.code} value={sound.code}>
                  {sound.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Location</Label>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select location..." />
            </SelectTrigger>
            <SelectContent>
              {config.locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Volume: {volume[0]}</Label>
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {isActive ? (
            <Button
              variant="destructive"
              onClick={handleStop}
              disabled={sending}
              className="flex-1"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Stop
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedSound && onPreview(selectedSound)}
                disabled={!selectedSound}
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                onClick={handlePlay}
                disabled={sending || !selectedSound || !selectedLocation || !isSessionActive}
                className="flex-1"
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Play
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
