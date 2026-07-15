import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { singularService } from './singularService';
import type {
  SingularSessionConfig,
  InitializeParams,
  AppUserResponse,
  TrackingAuthorizationStatus,
  GMSingularEvent,
} from './types';

const QUERY_KEY_APP_USER = ['gm', 'singular', 'app-user'] as const;

/**
 * Engine hook - Initializes GMSingular SDK on app boot.
 * Should be called once in the root layout.
 *
 * Flow (matches iOS GMSingularClient):
 * 1. startSingularSession() - Configure Singular SDK
 * 2. requestTrackingAuthorizationAndStartSingularSession() - Request ATT and start
 * 3. initialize() - Register with Going Merry backend
 */
export function useSingularEngine(
  sessionConfig: SingularSessionConfig | null,
  initializeParams: InitializeParams | null,
): {
  isReady: boolean;
  trackingStatus: TrackingAuthorizationStatus | null;
  appUser: AppUserResponse | null;
  error: Error | null;
} {
  const booted = useRef(false);
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingAuthorizationStatus | null>(null);
  const [appUser, setAppUser] = useState<AppUserResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (booted.current || !sessionConfig || !initializeParams) return;
    booted.current = true;

    let mounted = true;

    (async () => {
      try {
        // Step 1: Configure Singular SDK
        const configured = singularService.startSingularSession(sessionConfig);
        if (!configured) {
          throw new Error('Failed to configure Singular session');
        }

        // Step 2: Request ATT & Start session
        const status = await singularService.requestTrackingAuthorizationAndStartSingularSession();
        if (mounted) {
          setTrackingStatus(status);
        }

        // Step 3: Initialize (register with Going Merry backend)
        const user = await singularService.initialize(initializeParams);
        if (mounted) {
          setAppUser(user);
          setIsReady(true);
        }

        // Invalidate app user query
        queryClient.invalidateQueries({ queryKey: QUERY_KEY_APP_USER });
      } catch (err) {
        console.error('[GMSingular] Initialization failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sessionConfig, initializeParams, queryClient]);

  return { isReady, trackingStatus, appUser, error };
}

/**
 * Query hook - Access the current app user.
 */
export function useAppUser() {
  return useQuery<AppUserResponse | null>({
    queryKey: QUERY_KEY_APP_USER,
    queryFn: () => singularService.currentAppUser(),
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
 * Hook to get the Singular device ID.
 */
export function useSingularDeviceId(): string | undefined {
  const { data: appUser } = useAppUser();
  return appUser?.singularDeviceId;
}

/**
 * Hook to track events.
 */
export function useTrackEvent() {
  const trackEvent = useCallback(
    (name: string, args?: Record<string, string | number | boolean | null>) => {
      singularService.trackEvent(name, args);
    },
    [],
  );

  const trackRevenue = useCallback(
    (
      name: string,
      currency: string,
      amount: number,
      args?: Record<string, string | number | boolean | null>,
    ) => {
      singularService.trackRevenue(name, currency, amount, args);
    },
    [],
  );

  return { trackEvent, trackRevenue };
}

/**
 * Hook to get current ATT status.
 */
export function useTrackingAuthorizationStatus(): {
  status: TrackingAuthorizationStatus | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [status, setStatus] = useState<TrackingAuthorizationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const newStatus = await singularService.getTrackingAuthorizationStatus();
      setStatus(newStatus);
    } catch {
      setStatus('unavailable');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { status, isLoading, refetch };
}

/**
 * Hook to subscribe to GMSingular events.
 */
export function useSingularEvents(onEvent: (event: GMSingularEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const unsubscribe = singularService.subscribe((event) => {
      onEventRef.current(event);
    });

    return unsubscribe;
  }, []);
}

/**
 * Hook to manage GDPR tracking preferences.
 */
export function useGDPRControls() {
  const [isTrackingStopped, setIsTrackingStopped] = useState(() =>
    singularService.isAllTrackingStopped(),
  );

  const stopAllTracking = useCallback(() => {
    singularService.stopAllTracking();
    setIsTrackingStopped(true);
  }, []);

  const resumeAllTracking = useCallback(() => {
    singularService.resumeAllTracking();
    setIsTrackingStopped(false);
  }, []);

  const trackingOptIn = useCallback(() => {
    singularService.trackingOptIn();
    setIsTrackingStopped(false);
  }, []);

  return {
    isTrackingStopped,
    stopAllTracking,
    resumeAllTracking,
    trackingOptIn,
  };
}

/**
 * Hook to manage data sharing preferences (CCPA).
 */
export function useDataSharingControls() {
  const [isLimited, setIsLimited] = useState(() => singularService.getLimitDataSharing());

  const limitDataSharing = useCallback((shouldLimit: boolean) => {
    singularService.limitDataSharing(shouldLimit);
    setIsLimited(shouldLimit);
  }, []);

  return {
    isLimited,
    limitDataSharing,
  };
}

/**
 * Hook to manage global properties.
 */
export function useGlobalProperties() {
  const setGlobalProperty = useCallback(
    (key: string, value: string, overrideExisting = true) => {
      return singularService.setGlobalProperty(key, value, overrideExisting);
    },
    [],
  );

  const unsetGlobalProperty = useCallback((key: string) => {
    singularService.unsetGlobalProperty(key);
  }, []);

  const clearGlobalProperties = useCallback(() => {
    singularService.clearGlobalProperties();
  }, []);

  return {
    setGlobalProperty,
    unsetGlobalProperty,
    clearGlobalProperties,
  };
}
