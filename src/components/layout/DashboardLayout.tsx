import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleCheck } from '@/hooks/useRoleCheck';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Stethoscope,
  LayoutDashboard,
  Users,
  Music,
  ClipboardList,
  BarChart3,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles: ('admin' | 'examiner' | 'examinee')[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Sound Library',
    href: '/admin/sounds',
    icon: <Music className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Dashboard',
    href: '/examiner',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['examiner'],
  },
  {
    label: 'Sessions',
    href: '/examiner/sessions',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['examiner'],
  },
  {
    label: 'Analytics',
    href: '/examiner/analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['examiner'],
  },
  {
    label: 'Join Session',
    href: '/examinee',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['examinee'],
  },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const { role, isAdmin, isExaminer } = useRoleCheck();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!role) return false;
    if (role === 'admin') {
      return item.roles.includes('admin');
    }
    if (role === 'examiner') {
      return item.roles.includes('examiner');
    }
    return item.roles.includes('examinee');
  });

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              <span className="font-display font-bold text-lg hidden sm:inline">
                Praxis Medius
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    location.pathname === item.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
                {role}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
        <div className="flex justify-around py-2">
          {filteredNavItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                location.pathname === item.href
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6 pb-20 md:pb-6">{children}</main>
    </div>
  );
}
