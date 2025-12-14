import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useArduinoSerial } from '@/hooks/useArduinoSerial';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SoundSystemControl } from '@/components/SoundSystemControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, Square, Users, Copy, Loader2, CheckCircle, XCircle, Usb, Unplug, Terminal, StopCircle } from 'lucide-react';
import { Session, Sound, SoundSystem, Response as SessionResponse } from '@/types/database';

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
}

interface ActiveSound {
  system: SoundSystem;
  soundCode: string;
  location: string;
  volume: number;
}

export default function ExaminerSessionControl() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const arduino = useArduinoSerial();
  const [showLogs, setShowLogs] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-sound state - track active sounds per system
  const [activeSounds, setActiveSounds] = useState<Map<SoundSystem, ActiveSound>>(new Map());

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
      setupRealtimeSubscription();
    }
    return () => {
      supabase.removeAllChannels();
    };
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      const [sessionRes, soundsRes, participantsRes, responsesRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('sound_library').select('*'),
        supabase.from('session_participants').select('*').eq('session_id', sessionId),
        supabase.from('responses').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(50),
      ]);

      if (sessionRes.error) throw sessionRes.error;
      setSession(sessionRes.data as Session);
      setSounds((soundsRes.data as Sound[]) || []);
      setParticipants((participantsRes.data as Participant[]) || []);
      setResponses((responsesRes.data as SessionResponse[]) || []);
    } catch (error) {
      console.error('Error fetching session data:', error);
      toast({ title: 'Error', description: 'Failed to load session', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` }, 
        () => fetchSessionData()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setResponses(prev => [payload.new as SessionResponse, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const updateSessionStatus = async (status: 'pending' | 'active' | 'paused' | 'completed') => {
    if (!session) return;

    const updates: Partial<Session> = { status };
    if (status === 'active' && !session.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (status === 'completed') {
      updates.ended_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', session.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update session', variant: 'destructive' });
    } else {
      setSession({ ...session, ...updates });
      toast({ title: status === 'active' ? 'Session Started' : status === 'completed' ? 'Session Ended' : 'Session Updated' });
    }
  };

  const handlePlaySound = async (system: SoundSystem, soundCode: string, location: string, volume: number) => {
    if (!session) return;

    try {
      // Update session with current sound/location for this system
      const soundId = sounds.find(s => s.sound_code === soundCode)?.id;
      
      await supabase
        .from('sessions')
        .update({
          current_sound_id: soundId,
          current_location: location,
          current_volume: volume,
        })
        .eq('id', session.id);

      // Send command to Arduino
      await arduino.playSound(system, soundCode, location, volume);

      // Update active sounds state
      setActiveSounds(prev => {
        const newMap = new Map(prev);
        newMap.set(system, { system, soundCode, location, volume });
        return newMap;
      });

      toast({ title: 'Sound Playing', description: `${system.toUpperCase()}: ${soundCode} at ${location}` });
    } catch (error) {
      console.error('Error playing sound:', error);
      toast({ title: 'Error', description: 'Failed to play sound', variant: 'destructive' });
    }
  };

  const handleStopSound = async (system: SoundSystem) => {
    try {
      await arduino.stopSound();
      
      setActiveSounds(prev => {
        const newMap = new Map(prev);
        newMap.delete(system);
        return newMap;
      });

      toast({ title: 'Sound Stopped', description: `${system.toUpperCase()} speaker stopped` });
    } catch (error) {
      console.error('Error stopping sound:', error);
      toast({ title: 'Error', description: 'Failed to stop sound', variant: 'destructive' });
    }
  };

  const handleStopAllSounds = async () => {
    try {
      await arduino.stopSound();
      setActiveSounds(new Map());
      toast({ title: 'All Sounds Stopped' });
    } catch (error) {
      console.error('Error stopping sounds:', error);
      toast({ title: 'Error', description: 'Failed to stop sounds', variant: 'destructive' });
    }
  };

  const previewSound = (soundCode: string) => {
    const sound = sounds.find(s => s.sound_code === soundCode);
    if (sound?.file_url) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(sound.file_url);
      audioRef.current.volume = 0.5;
      audioRef.current.play();
    }
  };

  const copyJoinLink = () => {
    if (!session) return;
    const link = `${window.location.origin}/join/${session.session_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link Copied' });
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
          <Button variant="link" onClick={() => navigate('/examiner')}>Go back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const isSessionActive = session.status === 'active';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">{session.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                {session.status}
              </Badge>
              <code className="bg-muted px-2 py-1 rounded text-sm">{session.session_code}</code>
              <Button variant="ghost" size="sm" onClick={copyJoinLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            {session.status === 'pending' && (
              <Button onClick={() => updateSessionStatus('active')}>
                <Play className="mr-2 h-4 w-4" />
                Start Session
              </Button>
            )}
            {session.status === 'active' && (
              <>
                <Button variant="outline" onClick={() => updateSessionStatus('paused')}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={() => updateSessionStatus('completed')}>
                  <Square className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              </>
            )}
            {session.status === 'paused' && (
              <Button onClick={() => updateSessionStatus('active')}>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
            )}
          </div>
        </div>

        {/* Arduino Connection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="flex items-center gap-2">
                  {arduino.isConnected ? (
                    <Usb className="h-5 w-5 text-green-500" />
                  ) : (
                    <Unplug className="h-5 w-5 text-muted-foreground" />
                  )}
                  Manikin Hardware
                </CardTitle>
                <Badge variant={arduino.isConnected ? 'default' : 'secondary'}>
                  {arduino.isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                {!arduino.isSupported && (
                  <Badge variant="destructive">WebSerial Not Supported</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogs(!showLogs)}
                >
                  <Terminal className="h-4 w-4 mr-1" />
                  {showLogs ? 'Hide' : 'Show'} Logs
                </Button>
                {activeSounds.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleStopAllSounds}>
                    <StopCircle className="h-4 w-4 mr-1" />
                    Stop All
                  </Button>
                )}
                {arduino.isConnected ? (
                  <Button variant="destructive" size="sm" onClick={arduino.disconnect}>
                    <Unplug className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => arduino.connect()}
                    disabled={!arduino.isSupported || arduino.isConnecting}
                  >
                    {arduino.isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Usb className="h-4 w-4 mr-1" />
                    )}
                    Connect Arduino
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {showLogs && (
            <CardContent className="pt-0">
              <ScrollArea className="h-32 w-full rounded border bg-muted/30 p-2 font-mono text-xs">
                {arduino.logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet...</p>
                ) : (
                  arduino.logs.map((log, i) => (
                    <div key={i} className="text-muted-foreground">{log}</div>
                  ))
                )}
              </ScrollArea>
              <Button variant="ghost" size="sm" onClick={arduino.clearLogs} className="mt-2">
                Clear Logs
              </Button>
            </CardContent>
          )}
        </Card>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Multi-Sound Control Panel */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Multi-Speaker Control</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Control different body system speakers simultaneously
                    </p>
                  </div>
                  {activeSounds.size > 0 && (
                    <Badge variant="default" className="text-sm">
                      {activeSounds.size} Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <SoundSystemControl
                    system="lung"
                    sounds={sounds}
                    isActive={activeSounds.has('lung')}
                    isSessionActive={isSessionActive}
                    onPlay={handlePlaySound}
                    onStop={handleStopSound}
                    onPreview={previewSound}
                  />
                  <SoundSystemControl
                    system="heart"
                    sounds={sounds}
                    isActive={activeSounds.has('heart')}
                    isSessionActive={isSessionActive}
                    onPlay={handlePlaySound}
                    onStop={handleStopSound}
                    onPreview={previewSound}
                  />
                  <SoundSystemControl
                    system="bowel"
                    sounds={sounds}
                    isActive={activeSounds.has('bowel')}
                    isSessionActive={isSessionActive}
                    onPlay={handlePlaySound}
                    onStop={handleStopSound}
                    onPreview={previewSound}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Participants & Responses */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Participants ({participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students have joined yet</p>
                ) : (
                  <div className="space-y-2">
                    {participants.map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Student {idx + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Responses</CardTitle>
              </CardHeader>
              <CardContent>
                {responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No responses yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {responses.slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                        <span className="truncate">{r.submitted_location}</span>
                        <div className="flex items-center gap-1">
                          {r.is_location_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          {r.is_sound_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
