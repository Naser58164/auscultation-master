import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';

export function useRoleCheck() {
  const { role, loading } = useAuth();

  const isAdmin = role === 'admin';
  const isExaminer = role === 'examiner' || role === 'admin';
  const isExaminee = role === 'examinee';

  const hasRole = (requiredRole: AppRole): boolean => {
    if (!role) return false;
    
    // Admin has access to everything
    if (role === 'admin') return true;
    
    // Examiner has access to examiner and examinee features
    if (role === 'examiner' && (requiredRole === 'examiner' || requiredRole === 'examinee')) {
      return true;
    }
    
    // Examinee only has access to examinee features
    return role === requiredRole;
  };

  return {
    role,
    loading,
    isAdmin,
    isExaminer,
    isExaminee,
    hasRole,
  };
}
