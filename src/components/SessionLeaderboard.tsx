import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, User, Target, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  participantId: string;
  name: string;
  perfectAnswers: number;
  totalResponses: number;
  accuracy: number;
  avgResponseTime: number;
}

interface SessionLeaderboardProps {
  sessionId: string;
  compact?: boolean;
}

export function SessionLeaderboard({ sessionId, compact = false }: SessionLeaderboardProps) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    const channel = setupRealtimeSubscription();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const fetchLeaderboard = async () => {
    try {
      // Fetch all responses for this session
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('participant_id, is_location_correct, is_sound_correct, response_time_ms')
        .eq('session_id', sessionId);

      if (responsesError) throw responsesError;

      // Get unique participant IDs
      const participantIds = [...new Set(responses?.map(r => r.participant_id) || [])];

      // Fetch participant names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', participantIds);

      if (profilesError) throw profilesError;

      // Calculate stats per participant
      const statsMap = new Map<string, LeaderboardEntry>();

      participantIds.forEach(participantId => {
        const participantResponses = responses?.filter(r => r.participant_id === participantId) || [];
        const profile = profiles?.find(p => p.id === participantId);
        
        const perfectAnswers = participantResponses.filter(
          r => r.is_location_correct && r.is_sound_correct
        ).length;
        
        const totalResponses = participantResponses.length;
        const accuracy = totalResponses > 0 ? (perfectAnswers / totalResponses) * 100 : 0;
        
        const responseTimes = participantResponses
          .filter(r => r.response_time_ms !== null)
          .map(r => r.response_time_ms!);
        const avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
          : 0;

        statsMap.set(participantId, {
          participantId,
          name: profile?.full_name || profile?.email?.split('@')[0] || 'Anonymous',
          perfectAnswers,
          totalResponses,
          accuracy,
          avgResponseTime,
        });
      });

      // Sort by perfect answers (desc), then by avg response time (asc)
      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.perfectAnswers !== a.perfectAnswers) {
          return b.perfectAnswers - a.perfectAnswers;
        }
        return a.avgResponseTime - b.avgResponseTime;
      });

      setLeaderboard(sorted);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`leaderboard-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        // Refetch leaderboard when a new response is added
        fetchLeaderboard();
      })
      .subscribe();

    return channel;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground font-medium">{rank}</span>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No responses yet. Be the first to answer!
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayedLeaderboard = compact ? leaderboard.slice(0, 5) : leaderboard;

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
          {leaderboard.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {leaderboard.length} participants
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayedLeaderboard.map((entry, index) => {
          const isCurrentUser = entry.participantId === user?.id;
          const rank = index + 1;

          return (
            <div
              key={entry.participantId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                isCurrentUser 
                  ? "bg-primary/10 border border-primary/20" 
                  : "bg-muted/50 hover:bg-muted",
                rank === 1 && "bg-yellow-500/10 border border-yellow-500/20"
              )}
            >
              <div className="flex items-center justify-center w-8">
                {getRankIcon(rank)}
              </div>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className={cn(
                  "truncate font-medium",
                  isCurrentUser && "text-primary"
                )}>
                  {entry.name}
                  {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                </span>
              </div>

              {!compact && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1" title="Average response time">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{(entry.avgResponseTime / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex items-center gap-1" title="Accuracy">
                    <Target className="h-3.5 w-3.5" />
                    <span>{entry.accuracy.toFixed(0)}%</span>
                  </div>
                </div>
              )}

              <Badge 
                variant={rank === 1 ? "default" : "secondary"}
                className={cn(
                  "shrink-0",
                  rank === 1 && "bg-yellow-500 hover:bg-yellow-500/90"
                )}
              >
                {entry.perfectAnswers}/{entry.totalResponses}
              </Badge>
            </div>
          );
        })}

        {compact && leaderboard.length > 5 && (
          <p className="text-center text-xs text-muted-foreground pt-2">
            +{leaderboard.length - 5} more participants
          </p>
        )}
      </CardContent>
    </Card>
  );
}
