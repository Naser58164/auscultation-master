import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Target, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  totalSessions: number;
  totalResponses: number;
  avgAccuracy: number;
  avgResponseTime: number;
  systemBreakdown: { name: string; value: number }[];
  recentPerformance: { date: string; correct: number; incorrect: number }[];
}

const COLORS = ['hsl(200, 75%, 50%)', 'hsl(0, 72%, 55%)', 'hsl(145, 60%, 42%)'];

export default function ExaminerAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      // Fetch sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('examiner_id', user.id);

      const sessionIds = sessions?.map(s => s.id) || [];

      if (sessionIds.length === 0) {
        setData({
          totalSessions: 0,
          totalResponses: 0,
          avgAccuracy: 0,
          avgResponseTime: 0,
          systemBreakdown: [],
          recentPerformance: [],
        });
        setLoading(false);
        return;
      }

      // Fetch responses
      const { data: responses } = await supabase
        .from('responses')
        .select('*, sound_library!responses_expected_sound_id_fkey(system)')
        .in('session_id', sessionIds);

      const totalResponses = responses?.length || 0;
      const correctResponses = responses?.filter(r => r.is_location_correct && r.is_sound_correct).length || 0;
      const avgAccuracy = totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0;
      const avgResponseTime = responses?.reduce((acc, r) => acc + (r.response_time_ms || 0), 0) / totalResponses || 0;

      // System breakdown
      const systemCounts = { lung: 0, heart: 0, bowel: 0 };
      responses?.forEach(r => {
        const system = (r.sound_library as any)?.system;
        if (system && systemCounts.hasOwnProperty(system)) {
          systemCounts[system as keyof typeof systemCounts]++;
        }
      });

      setData({
        totalSessions: sessionIds.length,
        totalResponses,
        avgAccuracy: Math.round(avgAccuracy),
        avgResponseTime: Math.round(avgResponseTime / 1000), // Convert to seconds
        systemBreakdown: [
          { name: 'Lung', value: systemCounts.lung },
          { name: 'Heart', value: systemCounts.heart },
          { name: 'Bowel', value: systemCounts.bowel },
        ].filter(s => s.value > 0),
        recentPerformance: [],
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track student performance and session statistics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.totalSessions || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Responses
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.totalResponses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Accuracy
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.avgAccuracy || 0}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.avgResponseTime || 0}s</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* System Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Questions by System</CardTitle>
              <CardDescription>Distribution of sounds tested</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.systemBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No data available yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data?.systemBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data?.systemBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Performance Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>Tips based on student performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.avgAccuracy === 0 ? (
                  <p className="text-muted-foreground">
                    Start running sessions to see performance insights.
                  </p>
                ) : (
                  <>
                    {data?.avgAccuracy < 50 && (
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <h4 className="font-medium text-destructive">Low Accuracy Detected</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Consider reviewing basic auscultation techniques before the next session.
                        </p>
                      </div>
                    )}
                    {data?.avgAccuracy >= 50 && data?.avgAccuracy < 80 && (
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                        <h4 className="font-medium text-warning">Good Progress</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Students are improving! Focus on challenging sounds for continued growth.
                        </p>
                      </div>
                    )}
                    {data?.avgAccuracy >= 80 && (
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <h4 className="font-medium text-success">Excellent Performance</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Students are mastering auscultation skills. Consider introducing advanced cases.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
