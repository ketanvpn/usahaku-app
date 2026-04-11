import { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, User, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: setupStatus, isLoading: isSetupLoading, isFetching: isSetupFetching } = useQuery<{ needsSetup: boolean }>({
    queryKey: ["setup-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/setup/status`);
      return r.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: user, isLoading: isAuthLoading, isError } = useGetMe({
    query: { retry: false }
  });

  const isLoading = isSetupLoading || isAuthLoading;
  const isAuthenticated = !!user && !isError;
  const isSuperAdmin = user?.role === "super_admin";
  const isOwner = user?.role === "owner";

  useEffect(() => {
    if (!isSetupLoading && !isSetupFetching && setupStatus?.needsSetup && location !== "/setup" && location !== "/login") {
      setLocation("/setup");
    }
  }, [isSetupLoading, isSetupFetching, setupStatus, location, setLocation]);

  const logout = () => {
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated,
        isSuperAdmin,
        isOwner,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode, 
  allowedRoles?: ("super_admin" | "owner")[] 
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        if (user.role === "super_admin") {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/dashboard");
        }
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
