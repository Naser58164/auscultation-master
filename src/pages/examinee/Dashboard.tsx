import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2, ArrowRight, History, Headphones } from 'lucide-react';
import { Session } from '@/types/database';

export default function ExamineeDashboard() {
  const [sessionCode, setSessionCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { sessionCode: urlCode } = useParams<{ sessionCode: string }>();

  useEffect(() => {
    if (urlCode) {
      setSessionCode(urlCode);
      joinSession(urlCode);
    }
    fetchRecentSessions();
  }, [urlCode]);

  const fetchRecentSessions = async () => {
    if (!user) return;

    try {
      const { data: participations } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(5);

      if (participations && participations.length > 0) {
        const sessionIds = participations.map(p => p.session_id);
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .in('id', sessionIds);
        
        setRecentSessions((sessions as Session[]) || []);
      }
    } catch (error) {
      console.error('Error fetching recent sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (code?: string) => {
    const codeToUse = code || sessionCode.trim().toUpperCase();
    if (!codeToUse || !user) return;

    setJoining(true);
    try {
      // Find session by code
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_code', codeToUse)
        .single();

      if (sessionError || !session) {
        toast({
          title: 'Session Not Found',
          description: 'Please check the code and try again',
          variant: 'destructive',
        });
        setJoining(false);
        return;
      }

      if (session.status === 'completed') {
        toast({
          title: 'Session Ended',
          description: 'This session has already been completed',
          variant: 'destructive',
        });
        setJoining(false);
        return;
      }

      // Join session
      const { error: joinError } = await supabase
        .from('session_participants')
        .upsert({
          session_id: session.id,
          user_id: user.id,
        }, { onConflict: 'session_id,user_id' });

      if (joinError) throw joinError;

      toast({ title: 'Joined Session', description: `Welcome to ${session.name}` });
      navigate(`/examinee/session/${session.id}`);
    } catch (error: any) {
      console.error('Error joining session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join session',
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return '';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Join Session</h1>
            <p className="text-muted-foreground">
              Enter a session code to join an exam
            </p>
          </div>
          <Button onClick={() => navigate('/examinee/practice')} variant="outline">
            <Headphones className="mr-2 h-4 w-4" />
            Practice Mode
          </Button>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Enter Session Code
            </CardTitle>
            <CardDescription>
              Get the code from your examiner
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Session Code</Label>
                <Input
                  id="code"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              <Button
                onClick={() => joinSession()}
                disabled={joining || sessionCode.length < 6}
                className="w-full"
              >
                {joining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Session
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
            <CardDescription>Sessions you've participated in</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentSessions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No sessions yet. Join your first session above!
              </p>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/examinee/session/${session.id}`)}
                  >
                    <div>
                      <h3 className="font-medium">{session.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
