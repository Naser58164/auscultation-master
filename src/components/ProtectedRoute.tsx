import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { AppRole } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { hasRole, role } = useRoleCheck();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    // Redirect based on actual role
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (role === 'examiner') {
      return <Navigate to="/examiner" replace />;
    } else {
      return <Navigate to="/examinee" replace />;
    }
  }

  return <>{children}</>;
}
