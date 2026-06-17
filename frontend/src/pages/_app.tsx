import "src/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventStreamProvider } from "src/hooks/useEventStream";
import AppShell from "src/components/layout/AppShell";
import { useRouter } from "next/router";
import { useState } from "react";

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

  // Pages that bypass the main dashboard layout shell (e.g. login, onboarding)
  const isNoLayoutPage = ["/login", "/onboarding"].includes(router.pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <EventStreamProvider>
          {isNoLayoutPage ? (
            <Component {...pageProps} />
          ) : (
            <AppShell>
              <Component {...pageProps} />
            </AppShell>
          )}
        </EventStreamProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
