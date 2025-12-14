import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BodyDiagram } from '@/components/BodyDiagram';
import { SessionLeaderboard } from '@/components/SessionLeaderboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Clock, CheckCircle, Volume2, Radio, XCircle, MapPin, Music } from 'lucide-react';
import { Session, ALL_SOUNDS, ALL_LOCATIONS, SoundSystem } from '@/types/database';
import { toast as sonnerToast } from 'sonner';

interface ResponseFeedback {
  isLocationCorrect: boolean;
  isSoundCorrect: boolean;
  expectedLocationName: string;
  expectedSoundName: string;
  submittedLocationName: string;
  submittedSoundName: string;
  responseTimeMs: number | null;
}

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
  const [newQuestionAlert, setNewQuestionAlert] = useState(false);
  const prevSoundIdRef = useRef<string | null>(null);

  // Answer state
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState<string>('');
  const [feedback, setFeedback] = useState<ResponseFeedback | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      setupRealtimeSubscription();
    }
    return () => {
      supabase.removeAllChannels();
    };
  }, [sessionId]);

  // Reset when session sound changes (new question from examiner)
  useEffect(() => {
    if (session?.current_sound_id && session.current_sound_id !== prevSoundIdRef.current) {
      // New question received
      if (prevSoundIdRef.current !== null) {
        // Not the first load - show notification
        sonnerToast.info('New Question!', {
          description: 'The examiner has sent a new sound. Listen carefully!',
          icon: <Volume2 className="h-4 w-4" />,
        });
        setNewQuestionAlert(true);
        setTimeout(() => setNewQuestionAlert(false), 2000);
      }
      
      setSelectedLocation(null);
      setSelectedSound('');
      setSubmitted(false);
      setFeedback(null);
      setStartTime(Date.now());
      prevSoundIdRef.current = session.current_sound_id;
    }
  }, [session?.current_sound_id]);

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
    console.log('Setting up realtime subscription for session:', sessionId);
    
    const channel = supabase
      .channel(`examinee-session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        console.log('Session update received:', payload.new);
        const newSession = payload.new as Session;
        
        // Check for status changes
        if (session?.status !== newSession.status) {
          if (newSession.status === 'active') {
            sonnerToast.success('Session Started!', { description: 'The examiner has started the session.' });
          } else if (newSession.status === 'paused') {
            sonnerToast.info('Session Paused', { description: 'The examiner has paused the session.' });
          } else if (newSession.status === 'completed') {
            sonnerToast.success('Session Completed', { description: 'Thank you for participating!' });
          }
        }
        
        setSession(newSession);
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

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

      // Get the expected sound details
      let isSoundCorrect = false;
      let expectedSoundCode = '';
      if (expectedSoundId) {
        const { data: expectedSound } = await supabase
          .from('sound_library')
          .select('sound_code, name')
          .eq('id', expectedSoundId)
          .maybeSingle();
        if (expectedSound) {
          expectedSoundCode = expectedSound.sound_code;
          isSoundCorrect = expectedSound.sound_code === selectedSound;
        }
      }

      // Find the submitted sound ID
      const { data: submittedSoundData } = await supabase
        .from('sound_library')
        .select('id')
        .eq('sound_code', selectedSound)
        .maybeSingle();

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

      // Build feedback
      const expectedLocationName = ALL_LOCATIONS.find(l => l.id === expectedLocation)?.name || expectedLocation || 'Unknown';
      const expectedSoundName = ALL_SOUNDS.find(s => s.code === expectedSoundCode)?.name || expectedSoundCode || 'Unknown';
      const submittedLocationName = ALL_LOCATIONS.find(l => l.id === selectedLocation)?.name || selectedLocation || 'Unknown';
      const submittedSoundName = ALL_SOUNDS.find(s => s.code === selectedSound)?.name || selectedSound || 'Unknown';

      setFeedback({
        isLocationCorrect,
        isSoundCorrect,
        expectedLocationName,
        expectedSoundName,
        submittedLocationName,
        submittedSoundName,
        responseTimeMs: responseTime,
      });

      setSubmitted(true);
      
      if (isLocationCorrect && isSoundCorrect) {
        sonnerToast.success('Perfect!', { description: 'Both location and sound are correct!' });
      } else if (isLocationCorrect || isSoundCorrect) {
        sonnerToast.info('Partially Correct', { description: 'Review the feedback below.' });
      } else {
        sonnerToast.error('Incorrect', { description: 'Review the correct answers below.' });
      }
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

  // Session completed - redirect to summary
  if (session.status === 'completed') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <CheckCircle className="h-16 w-16 text-success mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">Session Completed</h2>
          <p className="text-muted-foreground mb-4">
            Thank you for participating!
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/examinee/session/${sessionId}/summary`)}>
              View Summary
            </Button>
            <Button variant="outline" onClick={() => navigate('/examinee')}>
              Back to Dashboard
            </Button>
          </div>
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
          <Badge className={`bg-success text-success-foreground ${newQuestionAlert ? 'animate-pulse scale-110' : ''} transition-transform`}>
            <Radio className="h-3 w-3 mr-1 animate-pulse" />
            Question Active
          </Badge>
        </div>

        {newQuestionAlert && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top duration-300">
            <Volume2 className="h-6 w-6 text-primary animate-bounce" />
            <div>
              <p className="font-semibold text-primary">New Sound Playing!</p>
              <p className="text-sm text-muted-foreground">Listen carefully and identify the sound.</p>
            </div>
          </div>
        )}

        {submitted && feedback ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center pb-4">
              {feedback.isLocationCorrect && feedback.isSoundCorrect ? (
                <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-success" />
                </div>
              ) : (
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
              )}
              <CardTitle className="text-2xl">
                {feedback.isLocationCorrect && feedback.isSoundCorrect
                  ? 'Perfect Answer!'
                  : feedback.isLocationCorrect || feedback.isSoundCorrect
                  ? 'Partially Correct'
                  : 'Incorrect'}
              </CardTitle>
              <CardDescription>
                {feedback.responseTimeMs && (
                  <span className="text-sm">Response time: {(feedback.responseTimeMs / 1000).toFixed(1)}s</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location Feedback */}
              <div className={`p-4 rounded-lg border-2 ${feedback.isLocationCorrect ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}`}>
                <div className="flex items-start gap-3">
                  <MapPin className={`h-5 w-5 mt-0.5 ${feedback.isLocationCorrect ? 'text-success' : 'text-destructive'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">Location</span>
                      {feedback.isLocationCorrect ? (
                        <Badge className="bg-success text-success-foreground text-xs">Correct</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Incorrect</Badge>
                      )}
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Your answer:</span>{' '}
                        <span className={feedback.isLocationCorrect ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          {feedback.submittedLocationName}
                        </span>
                      </p>
                      {!feedback.isLocationCorrect && (
                        <p>
                          <span className="text-muted-foreground">Correct answer:</span>{' '}
                          <span className="text-success font-medium">{feedback.expectedLocationName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sound Feedback */}
              <div className={`p-4 rounded-lg border-2 ${feedback.isSoundCorrect ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}`}>
                <div className="flex items-start gap-3">
                  <Music className={`h-5 w-5 mt-0.5 ${feedback.isSoundCorrect ? 'text-success' : 'text-destructive'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">Sound Type</span>
                      {feedback.isSoundCorrect ? (
                        <Badge className="bg-success text-success-foreground text-xs">Correct</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Incorrect</Badge>
                      )}
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Your answer:</span>{' '}
                        <span className={feedback.isSoundCorrect ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          {feedback.submittedSoundName}
                        </span>
                      </p>
                      {!feedback.isSoundCorrect && (
                        <p>
                          <span className="text-muted-foreground">Correct answer:</span>{' '}
                          <span className="text-success font-medium">{feedback.expectedSoundName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Summary */}
              <div className="text-center pt-4 border-t">
                <p className="text-lg font-semibold">
                  Score: {(feedback.isLocationCorrect ? 1 : 0) + (feedback.isSoundCorrect ? 1 : 0)} / 2
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Waiting for the next question from your examiner...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
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

            <div className="lg:col-span-1">
              <SessionLeaderboard sessionId={sessionId!} compact />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
