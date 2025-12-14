import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope, Shield, UserCog, GraduationCap, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

export default function Index() {
  const { user } = useAuth();
  const { role, isAdmin, isExaminer, isExaminee } = useRoleCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      if (isAdmin) {
        navigate('/admin');
      } else if (isExaminer) {
        navigate('/examiner');
      } else if (isExaminee) {
        navigate('/examinee');
      }
    }
  }, [user, role, isAdmin, isExaminer, isExaminee, navigate]);

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-primary/10 shadow-lg">
              <Stethoscope className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-foreground">
              Praxis Medius
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mb-8">
            A comprehensive medical auscultation training system for nursing education. 
            Practice identifying heart, lung, and bowel sounds with real-time feedback.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="relative overflow-hidden border-primary/20 hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-display">Administrator</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Manage users, upload and organize the audio library, and configure system settings.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-lung/20 hover:border-lung/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lung/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-lung/10">
                  <UserCog className="h-6 w-6 text-lung" />
                </div>
                <CardTitle className="font-display">Examiner</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Create exam sessions, control sound playback on the manikin, and score student responses in real-time.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-heart/20 hover:border-heart/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-heart/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-heart/10">
                  <GraduationCap className="h-6 w-6 text-heart" />
                </div>
                <CardTitle className="font-display">Examinee</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Join exam sessions, identify auscultation sounds and anatomical locations, and track your progress.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-3xl font-display font-bold mb-8">Key Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { title: 'Interactive Diagrams', desc: 'Click on anatomical locations to practice auscultation points' },
              { title: 'Real-time Sessions', desc: 'Live exam sessions with instant feedback and scoring' },
              { title: 'Arduino Integration', desc: 'Connect to physical manikins via serial bridge' },
              { title: 'Analytics Dashboard', desc: 'Track student performance and identify areas for improvement' },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl bg-card border">
                <h3 className="font-display font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
