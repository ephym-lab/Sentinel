import "src/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventStreamProvider } from "src/hooks/useEventStream";
import AppShell from "src/components/layout/AppShell";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useAuthStore } from "src/store/authStore";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [isReady, setIsReady] = useState(false);

  // Pages that don't require authentication
  const isPublicPage = ["/", "/login", "/register", "/onboarding"].includes(router.pathname);

  useEffect(() => {
    // Wait for hydration
    setIsReady(true);
    if (!token && !isPublicPage) {
      router.replace("/login");
    }
  }, [token, router.pathname]);

  if (!isReady) return null;
  if (!token && !isPublicPage) return null;

  return <>{children}</>;
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  // Initialize QueryClient inside component state to prevent cross-request cache sharing on SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  // Pages that bypass the main dashboard layout shell (e.g. login, onboarding, landing page)
  const isNoLayoutPage = ["/", "/login", "/register", "/onboarding"].includes(router.pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <EventStreamProvider>
          <AuthGuard>
            {isNoLayoutPage ? (
              <Component {...pageProps} />
            ) : (
              <AppShell>
                <Component {...pageProps} />
              </AppShell>
            )}
          </AuthGuard>
        </EventStreamProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
