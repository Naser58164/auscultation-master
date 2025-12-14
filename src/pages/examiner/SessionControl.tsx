import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useArduinoSerial } from '@/hooks/useArduinoSerial';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BodyDiagram } from '@/components/BodyDiagram';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, Square, Users, Copy, Send, Volume2, Loader2, CheckCircle, XCircle, Usb, Unplug, Terminal } from 'lucide-react';
import { Session, Sound, SoundSystem, ALL_LOCATIONS, LUNG_SOUNDS, HEART_SOUNDS, BOWEL_SOUNDS, Response as SessionResponse } from '@/types/database';

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
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

  // Control state
  const [selectedSystem, setSelectedSystem] = useState<SoundSystem>('lung');
  const [selectedSound, setSelectedSound] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [volume, setVolume] = useState([5]);
  const [sending, setSending] = useState(false);

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

  const sendCommand = async () => {
    if (!selectedSound || !selectedLocation || !session) {
      toast({ title: 'Missing Selection', description: 'Please select a sound and location', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // Update session with current sound/location
      const { error } = await supabase
        .from('sessions')
        .update({
          current_sound_id: sounds.find(s => s.sound_code === selectedSound)?.id,
          current_location: selectedLocation,
          current_volume: volume[0],
        })
        .eq('id', session.id);

      if (error) throw error;

      // Send command to Arduino via edge function
      await arduino.playSound(selectedSystem, selectedSound, selectedLocation, volume[0]);

      toast({ title: 'Command Sent', description: `Playing ${selectedSound} at ${selectedLocation}` });
    } catch (error) {
      console.error('Error sending command:', error);
      toast({ title: 'Error', description: 'Failed to send command', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStopSound = async () => {
    await arduino.stopSound();
  };

  const copyJoinLink = () => {
    if (!session) return;
    const link = `${window.location.origin}/join/${session.session_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link Copied' });
  };

  const getSoundOptions = () => {
    switch (selectedSystem) {
      case 'lung': return LUNG_SOUNDS;
      case 'heart': return HEART_SOUNDS;
      case 'bowel': return BOWEL_SOUNDS;
    }
  };

  const previewSound = () => {
    const sound = sounds.find(s => s.sound_code === selectedSound);
    if (sound?.file_url) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(sound.file_url);
      audioRef.current.volume = volume[0] / 10;
      audioRef.current.play();
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
          <Button variant="link" onClick={() => navigate('/examiner')}>Go back</Button>
        </div>
      </DashboardLayout>
    );
  }

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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Arduino Connection */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    {arduino.isConnected ? (
                      <Usb className="h-5 w-5 text-success" />
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
                  {arduino.isConnected ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleStopSound}>
                        <Square className="h-4 w-4 mr-1" />
                        Stop Sound
                      </Button>
                      <Button variant="destructive" size="sm" onClick={arduino.disconnect}>
                        <Unplug className="h-4 w-4 mr-1" />
                        Disconnect
                      </Button>
                    </>
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

          {/* Control Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Sound Control</CardTitle>
              <CardDescription>Select a sound and anatomical location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sound Selection */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>System</Label>
                    <Select value={selectedSystem} onValueChange={(v) => { setSelectedSystem(v as SoundSystem); setSelectedSound(''); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lung">🫁 Lungs</SelectItem>
                        <SelectItem value="heart">❤️ Heart</SelectItem>
                        <SelectItem value="bowel">🔊 Bowel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sound</Label>
                    <Select value={selectedSound} onValueChange={setSelectedSound}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sound..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getSoundOptions().map((sound) => (
                          <SelectItem key={sound.code} value={sound.code}>
                            {sound.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Volume: {volume[0]}</Label>
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
                    <Button variant="outline" onClick={previewSound} disabled={!selectedSound}>
                      <Play className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    <Button onClick={sendCommand} disabled={sending || !selectedSound || !selectedLocation || session.status !== 'active'} className="flex-1">
                      {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Command
                    </Button>
                  </div>
                </div>

                {/* Body Diagram */}
                <div>
                  <Label className="mb-2 block">Location: {selectedLocation ? ALL_LOCATIONS.find(l => l.id === selectedLocation)?.name : 'Click to select'}</Label>
                  <BodyDiagram
                    selectedLocation={selectedLocation}
                    onLocationSelect={setSelectedLocation}
                    activeSystems={[selectedSystem]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span>Student {participants.indexOf(p) + 1}</span>
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
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          {r.is_sound_correct ? (
                            <CheckCircle className="h-4 w-4 text-success" />
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
