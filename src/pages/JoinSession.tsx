import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Clock, CheckCircle, AlertCircle, Stethoscope } from 'lucide-react';
import { Session } from '@/types/database';

export default function JoinSession() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionCode) {
      fetchSession();
    }
  }, [sessionCode]);

  // Auto-join if authenticated and session is valid
  useEffect(() => {
    if (user && session && !error) {
      handleJoin();
    }
  }, [user, session]);

  const fetchSession = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_code', sessionCode?.toUpperCase())
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Session not found. Please check the code and try again.');
        setLoading(false);
        return;
      }

      if (data.status === 'completed') {
        setError('This session has already ended.');
        setLoading(false);
        return;
      }

      setSession(data as Session);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to load session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !session) return;

    setJoining(true);
    try {
      const { error: joinError } = await supabase
        .from('session_participants')
        .upsert({
          session_id: session.id,
          user_id: user.id,
        }, { onConflict: 'session_id,user_id' });

      if (joinError) throw joinError;

      toast({ title: 'Joined Session', description: `Welcome to ${session.name}` });
      navigate(`/examinee/session/${session.id}`);
    } catch (err: any) {
      console.error('Error joining session:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to join session',
        variant: 'destructive',
      });
      setJoining(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success text-success-foreground">Active - In Progress</Badge>;
      case 'pending':
        return <Badge variant="secondary">Waiting to Start</Badge>;
      case 'paused':
        return <Badge className="bg-warning text-warning-foreground">Paused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Session Not Available</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate('/examinee')} variant="default">
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate('/auth')} variant="outline">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Joining state (authenticated user, auto-joining)
  if (user && joining) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Joining {session?.name}...</p>
            <p className="text-muted-foreground">Please wait</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Unauthenticated user - show session preview and prompt to sign in
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Exam Session</CardTitle>
          <CardDescription>
            You've been invited to participate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Session</span>
              <span className="font-semibold">{session?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Code</span>
              <code className="font-mono bg-background px-2 py-1 rounded text-sm">
                {sessionCode?.toUpperCase()}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {session && getStatusBadge(session.status)}
            </div>
          </div>

          {/* Auth Required Message */}
          {!user && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex gap-3">
                <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Sign in to join</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a free account or sign in to participate in this session.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {user ? (
              <Button onClick={handleJoin} disabled={joining} size="lg">
                {joining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Join Session
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => navigate(`/auth?redirect=/join/${sessionCode}`)}
                  size="lg"
                >
                  Sign In to Join
                </Button>
                <Button
                  onClick={() => navigate(`/auth?mode=signup&redirect=/join/${sessionCode}`)}
                  variant="outline"
                  size="lg"
                >
                  Create Account
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">Praxis Medius</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
