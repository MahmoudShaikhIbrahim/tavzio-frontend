import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

interface Props {
  allow: Array<'super_admin' | 'business_owner' | 'staff'>;
}

export default function RequireRole({ allow }: Props) {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-brass/40" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;

  if (!allow.includes(user.role)) {
    // Logged in, just not allowed here - send them to where they DO belong
    // rather than a dead end.
    const home = user.role === 'super_admin' ? '/admin/super/businesses' : '/admin/dashboard';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
