import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BodyDiagram } from '@/components/BodyDiagram';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Clock, CheckCircle } from 'lucide-react';
import { Session, ALL_SOUNDS, ALL_LOCATIONS, SoundSystem } from '@/types/database';

export default function ExamineeSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Answer state
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<string>('');

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      setupRealtimeSubscription();
    }
    return () => {
      supabase.removeAllChannels();
    };
  }, [sessionId]);

  // Reset when session sound changes
  useEffect(() => {
    if (session?.current_sound_id) {
      setSelectedLocation(null);
      setSelectedSound('');
      setSubmitted(false);
      setStartTime(Date.now());
    }
  }, [session?.current_sound_id, session?.current_location]);

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data as Session);
    } catch (error) {
      console.error('Error fetching session:', error);
      toast({ title: 'Error', description: 'Session not found', variant: 'destructive' });
      navigate('/examinee');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`examinee-session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(payload.new as Session);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const submitResponse = async () => {
    if (!selectedLocation || !selectedSound || !session || !user) {
      toast({ title: 'Incomplete', description: 'Please select both a location and sound', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const responseTime = startTime ? Date.now() - startTime : null;
      
      // Determine correctness
      const expectedLocation = session.current_location;
      const expectedSoundId = session.current_sound_id;
      const isLocationCorrect = selectedLocation === expectedLocation;

      // Get the expected sound code to compare
      let isSoundCorrect = false;
      if (expectedSoundId) {
        const { data: expectedSound } = await supabase
          .from('sound_library')
          .select('sound_code')
          .eq('id', expectedSoundId)
          .single();
        isSoundCorrect = expectedSound?.sound_code === selectedSound;
      }

      // Find the submitted sound ID
      const { data: submittedSoundData } = await supabase
        .from('sound_library')
        .select('id')
        .eq('sound_code', selectedSound)
        .single();

      const { error } = await supabase
        .from('responses')
        .insert({
          session_id: session.id,
          participant_id: user.id,
          expected_sound_id: expectedSoundId,
          expected_location: expectedLocation,
          submitted_sound_id: submittedSoundData?.id,
          submitted_location: selectedLocation,
          is_sound_correct: isSoundCorrect,
          is_location_correct: isLocationCorrect,
          response_time_ms: responseTime,
        });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: 'Response Submitted',
        description: isLocationCorrect && isSoundCorrect
          ? 'Correct! Great job!'
          : 'Submitted. Wait for the next question.',
      });
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast({ title: 'Error', description: 'Failed to submit response', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
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

  if (!session) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Session not found</p>
          <Button variant="link" onClick={() => navigate('/examinee')}>Go back</Button>
        </div>
      </DashboardLayout>
    );
  }

  // Waiting room
  if (session.status === 'pending') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="animate-pulse mb-4">
            <Clock className="h-16 w-16 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Waiting for Session to Start</h2>
          <p className="text-muted-foreground mb-4">
            The examiner will start the session shortly.
          </p>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {session.name}
          </Badge>
        </div>
      </DashboardLayout>
    );
  }

  // Session completed
  if (session.status === 'completed') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <CheckCircle className="h-16 w-16 text-success mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">Session Completed</h2>
          <p className="text-muted-foreground mb-4">
            Thank you for participating!
          </p>
          <Button onClick={() => navigate('/examinee')}>Back to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  // Session paused
  if (session.status === 'paused') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="animate-pulse mb-4">
            <Clock className="h-16 w-16 text-warning" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Session Paused</h2>
          <p className="text-muted-foreground mb-4">
            The examiner has paused the session. Please wait.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Active session - waiting for question
  if (!session.current_sound_id) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="animate-pulse mb-4">
            <Clock className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Waiting for Next Question</h2>
          <p className="text-muted-foreground mb-4">
            Listen carefully and be ready to identify the sound.
          </p>
          <Badge className="bg-success text-success-foreground">Session Active</Badge>
        </div>
      </DashboardLayout>
    );
  }

  // Active session with question
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">{session.name}</h1>
            <p className="text-muted-foreground">
              Identify the sound you hear
            </p>
          </div>
          <Badge className="bg-success text-success-foreground animate-pulse">
            Question Active
          </Badge>
        </div>

        {submitted ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
              <h2 className="text-2xl font-display font-bold mb-2">Response Submitted</h2>
              <p className="text-muted-foreground">
                Wait for the next question from your examiner.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Where did you hear the sound?</CardTitle>
                <CardDescription>Click on the anatomical location</CardDescription>
              </CardHeader>
              <CardContent>
                <BodyDiagram
                  selectedLocation={selectedLocation}
                  onLocationSelect={setSelectedLocation}
                />
                {selectedLocation && (
                  <p className="text-center mt-4 font-medium">
                    Selected: {ALL_LOCATIONS.find(l => l.id === selectedLocation)?.name}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What sound did you hear?</CardTitle>
                <CardDescription>Select the type of sound</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sound Type</Label>
                  <Select value={selectedSound} onValueChange={setSelectedSound}>
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

                <Button
                  onClick={submitResponse}
                  disabled={submitting || !selectedLocation || !selectedSound}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Answer
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
