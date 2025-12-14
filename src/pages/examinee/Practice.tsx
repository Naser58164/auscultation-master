import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BodyDiagram } from '@/components/BodyDiagram';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Shuffle,
  Target,
  Trophy,
  Music,
  MapPin,
  Lightbulb
} from 'lucide-react';
import { ALL_SOUNDS, ALL_LOCATIONS, SoundSystem } from '@/types/database';

interface SoundLibraryItem {
  id: string;
  name: string;
  sound_code: string;
  system: SoundSystem;
  file_url: string | null;
  description: string | null;
}

interface PracticeStats {
  totalAttempts: number;
  correctSounds: number;
  correctLocations: number;
  perfectAnswers: number;
}

export default function Practice() {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [sounds, setSounds] = useState<SoundLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSound, setCurrentSound] = useState<SoundLibraryItem | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // User answers
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<string>('');

  // Practice stats (session only)
  const [stats, setStats] = useState<PracticeStats>({
    totalAttempts: 0,
    correctSounds: 0,
    correctLocations: 0,
    perfectAnswers: 0,
  });

  useEffect(() => {
    fetchSounds();
  }, []);

  const fetchSounds = async () => {
    try {
      const { data, error } = await supabase
        .from('sound_library')
        .select('id, name, sound_code, system, file_url, description')
        .not('file_url', 'is', null);

      if (error) throw error;
      setSounds(data || []);
      
      if (data && data.length > 0) {
        pickRandomQuestion(data);
      }
    } catch (error) {
      console.error('Error fetching sounds:', error);
      toast({ title: 'Error', description: 'Failed to load sounds', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const pickRandomQuestion = (availableSounds?: SoundLibraryItem[]) => {
    const soundList = availableSounds || sounds;
    if (soundList.length === 0) return;

    // Pick random sound
    const randomSound = soundList[Math.floor(Math.random() * soundList.length)];
    setCurrentSound(randomSound);

    // Pick random location based on sound system
    let validLocations = ALL_LOCATIONS;
    if (randomSound.system === 'lung') {
      validLocations = ALL_LOCATIONS.filter(l => l.system === 'lung');
    } else if (randomSound.system === 'heart') {
      validLocations = ALL_LOCATIONS.filter(l => l.system === 'heart');
    } else if (randomSound.system === 'bowel') {
      validLocations = ALL_LOCATIONS.filter(l => l.system === 'bowel');
    }
    
    const randomLocation = validLocations[Math.floor(Math.random() * validLocations.length)];
    setCurrentLocation(randomLocation?.id || null);

    // Reset state
    setSelectedLocation(null);
    setSelectedSound('');
    setHasSubmitted(false);
    setShowAnswer(false);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const playSound = () => {
    if (!currentSound?.file_url) {
      toast({ title: 'No audio', description: 'This sound has no audio file', variant: 'destructive' });
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(currentSound.file_url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        toast({ title: 'Error', description: 'Failed to play audio', variant: 'destructive' });
        setIsPlaying(false);
      };
    } else {
      audioRef.current.src = currentSound.file_url;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const submitAnswer = () => {
    if (!selectedLocation || !selectedSound || !currentSound || !currentLocation) {
      toast({ title: 'Incomplete', description: 'Please select both a location and sound', variant: 'destructive' });
      return;
    }

    const isLocationCorrect = selectedLocation === currentLocation;
    const isSoundCorrect = selectedSound === currentSound.sound_code;

    setStats(prev => ({
      totalAttempts: prev.totalAttempts + 1,
      correctSounds: prev.correctSounds + (isSoundCorrect ? 1 : 0),
      correctLocations: prev.correctLocations + (isLocationCorrect ? 1 : 0),
      perfectAnswers: prev.perfectAnswers + (isLocationCorrect && isSoundCorrect ? 1 : 0),
    }));

    setHasSubmitted(true);
    setShowAnswer(true);
  };

  const resetStats = () => {
    setStats({
      totalAttempts: 0,
      correctSounds: 0,
      correctLocations: 0,
      perfectAnswers: 0,
    });
    toast({ title: 'Stats Reset', description: 'Your practice statistics have been cleared' });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (sounds.length === 0) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Sounds Available</h2>
          <p className="text-muted-foreground">
            There are no sounds in the library yet. Please contact an administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const accuracy = stats.totalAttempts > 0 
    ? Math.round((stats.perfectAnswers / stats.totalAttempts) * 100) 
    : 0;

  const isLocationCorrect = hasSubmitted && selectedLocation === currentLocation;
  const isSoundCorrect = hasSubmitted && selectedSound === currentSound?.sound_code;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Practice Mode</h1>
            <p className="text-muted-foreground">
              Listen to sounds and practice identification at your own pace
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Lightbulb className="h-4 w-4 mr-2" />
            Self-Paced Learning
          </Badge>
        </div>

        {/* Stats Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                  <p className="text-xs text-muted-foreground">Attempts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{stats.perfectAnswers}</p>
                  <p className="text-xs text-muted-foreground">Perfect</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={accuracy} className="w-32" />
                <Button variant="ghost" size="sm" onClick={resetStats}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Play Sound Section */}
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-medium text-center">
                Listen to the sound and identify what you hear
              </p>
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  onClick={playSound}
                  className="h-16 w-16 rounded-full"
                  disabled={!currentSound?.file_url}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => pickRandomQuestion()}
                  disabled={!hasSubmitted}
                >
                  <Shuffle className="h-5 w-5 mr-2" />
                  Next Question
                </Button>
              </div>
              {currentSound && (
                <p className="text-sm text-muted-foreground">
                  System: <Badge variant="secondary">{currentSound.system}</Badge>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Answer Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Location Selection */}
          <Card className={hasSubmitted ? (isLocationCorrect ? 'border-success' : 'border-destructive') : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Where did you hear the sound?
                {hasSubmitted && (
                  isLocationCorrect 
                    ? <CheckCircle className="h-5 w-5 text-success ml-auto" />
                    : <XCircle className="h-5 w-5 text-destructive ml-auto" />
                )}
              </CardTitle>
              <CardDescription>Click on the anatomical location</CardDescription>
            </CardHeader>
            <CardContent>
              <BodyDiagram
                selectedLocation={selectedLocation}
                onLocationSelect={hasSubmitted ? () => {} : setSelectedLocation}
                highlightedLocation={showAnswer ? currentLocation : undefined}
              />
              {selectedLocation && (
                <p className="text-center mt-4 font-medium">
                  Selected: {ALL_LOCATIONS.find(l => l.id === selectedLocation)?.name}
                </p>
              )}
              {showAnswer && !isLocationCorrect && currentLocation && (
                <p className="text-center mt-2 text-success font-medium">
                  Correct: {ALL_LOCATIONS.find(l => l.id === currentLocation)?.name}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sound Selection */}
          <Card className={hasSubmitted ? (isSoundCorrect ? 'border-success' : 'border-destructive') : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                What sound did you hear?
                {hasSubmitted && (
                  isSoundCorrect 
                    ? <CheckCircle className="h-5 w-5 text-success ml-auto" />
                    : <XCircle className="h-5 w-5 text-destructive ml-auto" />
                )}
              </CardTitle>
              <CardDescription>Select the type of sound</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sound Type</Label>
                <Select 
                  value={selectedSound} 
                  onValueChange={setSelectedSound}
                  disabled={hasSubmitted}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sound..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Lung Sounds</div>
                    {ALL_SOUNDS.filter(s => s.code.startsWith('LUNG')).map((sound) => (
                      <SelectItem key={sound.code} value={sound.code}>
                        {sound.name}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Heart Sounds</div>
                    {ALL_SOUNDS.filter(s => s.code.startsWith('HEART')).map((sound) => (
                      <SelectItem key={sound.code} value={sound.code}>
                        {sound.name}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Bowel Sounds</div>
                    {ALL_SOUNDS.filter(s => s.code.startsWith('BOWEL')).map((sound) => (
                      <SelectItem key={sound.code} value={sound.code}>
                        {sound.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showAnswer && !isSoundCorrect && currentSound && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <p className="text-sm font-medium text-success">
                    Correct Answer: {currentSound.name}
                  </p>
                  {currentSound.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentSound.description}
                    </p>
                  )}
                </div>
              )}

              {!hasSubmitted ? (
                <Button
                  onClick={submitAnswer}
                  disabled={!selectedLocation || !selectedSound}
                  className="w-full"
                  size="lg"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Check Answer
                </Button>
              ) : (
                <Button
                  onClick={() => pickRandomQuestion()}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  Try Another
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Result Feedback */}
        {hasSubmitted && (
          <Card className={isLocationCorrect && isSoundCorrect ? 'bg-success/10 border-success' : 'bg-muted'}>
            <CardContent className="py-6 text-center">
              {isLocationCorrect && isSoundCorrect ? (
                <div className="flex items-center justify-center gap-3">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-xl font-bold text-success">Perfect!</p>
                    <p className="text-sm text-muted-foreground">Both location and sound are correct</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium">
                    {isLocationCorrect || isSoundCorrect ? 'Partially Correct' : 'Incorrect'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Review the correct answers above and try again
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
