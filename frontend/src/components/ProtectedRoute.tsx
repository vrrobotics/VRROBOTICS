// Login/signup has been removed from the app — every route is now public.
// ProtectedRoute is kept as a transparent pass-through so the existing route
// wiring in App.tsx (which wraps many routes in <ProtectedRoute>) keeps working
// without auth checks or redirects. `requiredRole` is accepted and ignored.
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  return <>{children}</>;
};

export default ProtectedRoute;
