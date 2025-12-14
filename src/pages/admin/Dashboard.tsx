import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Music, BarChart3, Shield, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  totalUsers: number;
  totalSounds: number;
  totalSessions: number;
  activeExaminers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalSounds: 0,
    totalSessions: 0,
    activeExaminers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [profilesRes, soundsRes, sessionsRes, examinersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('sound_library').select('id', { count: 'exact', head: true }),
        supabase.from('sessions').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'examiner'),
      ]);

      setStats({
        totalUsers: profilesRes.count || 0,
        totalSounds: soundsRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        activeExaminers: examinersRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/admin/users',
    },
    {
      title: 'Sound Library',
      value: stats.totalSounds,
      icon: Music,
      color: 'text-lung',
      bgColor: 'bg-lung/10',
      href: '/admin/sounds',
    },
    {
      title: 'Total Sessions',
      value: stats.totalSessions,
      icon: BarChart3,
      color: 'text-heart',
      bgColor: 'bg-heart/10',
      href: '/admin',
    },
    {
      title: 'Active Examiners',
      value: stats.activeExaminers,
      icon: Shield,
      color: 'text-bowel',
      bgColor: 'bg-bowel/10',
      href: '/admin/users',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, sounds, and system settings
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link key={stat.title} to={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {loading ? '...' : stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Sound Library</CardTitle>
              <CardDescription>
                Manage audio files for auscultation training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin/sounds">
                  <Plus className="mr-2 h-4 w-4" />
                  Manage Sounds
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">User Management</CardTitle>
              <CardDescription>
                Assign roles and manage user access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
