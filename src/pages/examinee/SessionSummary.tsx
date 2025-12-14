import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Music,
  TrendingUp,
  Award,
  ArrowLeft
} from 'lucide-react';

interface ResponseData {
  id: string;
  is_location_correct: boolean | null;
  is_sound_correct: boolean | null;
  response_time_ms: number | null;
  created_at: string;
}

interface SessionData {
  id: string;
  name: string;
  started_at: string | null;
  ended_at: string | null;
}

interface SummaryStats {
  totalQuestions: number;
  correctLocations: number;
  correctSounds: number;
  perfectAnswers: number;
  averageResponseTime: number;
  fastestResponse: number;
  slowestResponse: number;
  locationAccuracy: number;
  soundAccuracy: number;
  overallAccuracy: number;
}

export default function SessionSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);

  useEffect(() => {
    if (sessionId && user) {
      fetchSummary();
    }
  }, [sessionId, user]);

  const fetchSummary = async () => {
    try {
      // Fetch session details
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, name, started_at, ended_at')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        toast({ title: 'Error', description: 'Session not found', variant: 'destructive' });
        navigate('/examinee');
        return;
      }

      setSession(sessionData);

      // Fetch user's responses for this session
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('id, is_location_correct, is_sound_correct, response_time_ms, created_at')
        .eq('session_id', sessionId)
        .eq('participant_id', user!.id)
        .order('created_at', { ascending: true });

      if (responsesError) throw responsesError;

      // Calculate statistics
      const totalQuestions = responses?.length || 0;
      
      if (totalQuestions === 0) {
        setStats({
          totalQuestions: 0,
          correctLocations: 0,
          correctSounds: 0,
          perfectAnswers: 0,
          averageResponseTime: 0,
          fastestResponse: 0,
          slowestResponse: 0,
          locationAccuracy: 0,
          soundAccuracy: 0,
          overallAccuracy: 0,
        });
      } else {
        const correctLocations = responses!.filter(r => r.is_location_correct).length;
        const correctSounds = responses!.filter(r => r.is_sound_correct).length;
        const perfectAnswers = responses!.filter(r => r.is_location_correct && r.is_sound_correct).length;
        
        const responseTimes = responses!
          .filter(r => r.response_time_ms !== null)
          .map(r => r.response_time_ms!);
        
        const averageResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
          : 0;
        const fastestResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
        const slowestResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

        setStats({
          totalQuestions,
          correctLocations,
          correctSounds,
          perfectAnswers,
          averageResponseTime,
          fastestResponse,
          slowestResponse,
          locationAccuracy: (correctLocations / totalQuestions) * 100,
          soundAccuracy: (correctSounds / totalQuestions) * 100,
          overallAccuracy: (perfectAnswers / totalQuestions) * 100,
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast({ title: 'Error', description: 'Failed to load session summary', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceGrade = (accuracy: number): { grade: string; color: string; message: string } => {
    if (accuracy >= 90) return { grade: 'A+', color: 'text-success', message: 'Outstanding!' };
    if (accuracy >= 80) return { grade: 'A', color: 'text-success', message: 'Excellent!' };
    if (accuracy >= 70) return { grade: 'B', color: 'text-primary', message: 'Good job!' };
    if (accuracy >= 60) return { grade: 'C', color: 'text-warning', message: 'Keep practicing!' };
    if (accuracy >= 50) return { grade: 'D', color: 'text-orange-500', message: 'Needs improvement' };
    return { grade: 'F', color: 'text-destructive', message: 'More practice needed' };
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

  if (!session || !stats) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Summary not available</p>
          <Button variant="link" onClick={() => navigate('/examinee')}>Go back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const performance = getPerformanceGrade(stats.overallAccuracy);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/examinee')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold">Session Summary</h1>
            <p className="text-muted-foreground">{session.name}</p>
          </div>
        </div>

        {stats.totalQuestions === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No responses recorded for this session.</p>
              <Button variant="link" onClick={() => navigate('/examinee')}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overall Performance Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-background border-4 border-primary/20 flex items-center justify-center">
                      <span className={`text-3xl font-bold ${performance.color}`}>{performance.grade}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{performance.message}</h2>
                      <p className="text-muted-foreground">
                        {stats.perfectAnswers} of {stats.totalQuestions} perfect answers
                      </p>
                    </div>
                  </div>
                  <Trophy className={`h-12 w-12 ${stats.overallAccuracy >= 70 ? 'text-yellow-500' : 'text-muted-foreground/30'}`} />
                </div>
              </div>
            </Card>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Overall Accuracy */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Overall Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.overallAccuracy.toFixed(0)}%</div>
                  <Progress value={stats.overallAccuracy} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Perfect answers (both correct)
                  </p>
                </CardContent>
              </Card>

              {/* Location Accuracy */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Location Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.locationAccuracy.toFixed(0)}%</div>
                  <Progress value={stats.locationAccuracy} className="mt-2 [&>div]:bg-blue-500" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.correctLocations} of {stats.totalQuestions} correct
                  </p>
                </CardContent>
              </Card>

              {/* Sound Accuracy */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Music className="h-4 w-4 text-purple-500" />
                    Sound Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.soundAccuracy.toFixed(0)}%</div>
                  <Progress value={stats.soundAccuracy} className="mt-2 [&>div]:bg-purple-500" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.correctSounds} of {stats.totalQuestions} correct
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Response Time Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Response Times
                </CardTitle>
                <CardDescription>How quickly you responded to questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {(stats.fastestResponse / 1000).toFixed(1)}s
                    </div>
                    <p className="text-sm text-muted-foreground">Fastest</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(stats.averageResponseTime / 1000).toFixed(1)}s
                    </div>
                    <p className="text-sm text-muted-foreground">Average</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">
                      {(stats.slowestResponse / 1000).toFixed(1)}s
                    </div>
                    <p className="text-sm text-muted-foreground">Slowest</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Answer Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <span className="font-medium">Perfect Answers</span>
                    </div>
                    <Badge className="bg-success text-success-foreground">{stats.perfectAnswers}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="font-medium">Partial Correct</span>
                    </div>
                    <Badge variant="outline">
                      {(stats.correctLocations + stats.correctSounds) - (stats.perfectAnswers * 2)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="font-medium">Both Incorrect</span>
                    </div>
                    <Badge variant="destructive">
                      {stats.totalQuestions - stats.perfectAnswers - 
                        ((stats.correctLocations - stats.perfectAnswers) + (stats.correctSounds - stats.perfectAnswers))}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action */}
            <div className="flex justify-center">
              <Button onClick={() => navigate('/examinee')} size="lg">
                Back to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
