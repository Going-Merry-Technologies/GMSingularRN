import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { singularService } from './singularService';
import type { GMSingularConfig, AppUserResponse } from './types';

/**
 * Engine hook - Initializes Singular SDK on app boot.
 * Should be called once in the root layout.
 */
export function useSingularEngine(config: GMSingularConfig | null): void {
  const booted = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (booted.current || !config) return;
    booted.current = true;

    (async () => {
      try {
        // Step 1: Configure
        singularService.configure(config);

        // Step 2: Start session
        singularService.startSession();

        // Step 3: Initialize (register with backend)
        await singularService.initialize();

        // Invalidate app user query
        queryClient.invalidateQueries({ queryKey: ['gm', 'singular', 'app-user'] });
      } catch (error) {
        console.error('[GMSingular] Initialization failed:', error);
      }
    })();
  }, [config, queryClient]);
}

/**
 * Query hook - Access the current app user.
 */
export function useAppUser() {
  return useQuery<AppUserResponse | null>({
    queryKey: ['gm', 'singular', 'app-user'],
    queryFn: () => singularService.getAppUser(),
    staleTime: Infinity,
  });
}

/**
 * Hook to get the custom user ID.
 */
export function useCustomUserId(): string | undefined {
  const { data: appUser } = useAppUser();
  return appUser?.customUserId;
}

/**
 * Hook to track events.
 */
export function useTrackEvent() {
  return {
    trackEvent: (name: string, args?: Record<string, unknown>) => {
      singularService.trackEvent(name, args);
    },
    trackRevenue: (
      name: string,
      currency: string,
      amount: number,
      args?: Record<string, unknown>,
    ) => {
      singularService.trackRevenue(name, currency, amount, args);
    },
  };
}
