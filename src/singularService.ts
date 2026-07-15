// @ts-nocheck
import { Singular, SingularConfig } from 'singular-react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
  PermissionStatus,
} from 'expo-tracking-transparency';
import { createAppUser } from './api';
import type {
  SingularSessionConfig,
  GMSingularEvent,
  AppUserResponse,
  CreateAppUserRequest,
  TrackingAuthorizationStatus,
  InitializeParams,
  SingularLinkParams,
  DeviceAttributionData,
} from './types';
import { GMSingularError, GMSingularErrorCode } from './types';

const DEFAULT_BACKEND_URL = 'https://events.goingmerry.xyz';
const ATT_TIMEOUT_SECONDS = 300;

// Secure storage keys
const STORAGE_KEY_CUSTOMER_USER_ID = 'gm_singular_customer_user_id';
const STORAGE_KEY_APP_USER = 'gm_singular_app_user';

/**
 * GMSingularService - Wrapper around Singular SDK for React Native.
 * Equivalent to SingularManager + GMSingularClient in the iOS SDK.
 *
 * Usage (matches iOS SingularManager):
 * 1. Call startSession(customerUserId) to configure Singular SDK
 * 2. Call requestATT() to request ATT and start Singular
 * 3. Call initialize(params) to register with Going Merry backend
 */
class GMSingularService {
  private singularConfig: SingularConfig | null = null;
  private cachedAppUser: AppUserResponse | null = null;
  private isStarted = false;
  private eventListeners: ((event: GMSingularEvent) => void)[] = [];

  /**
   * Get or create customerUserId (IDFV).
   * Equivalent to iOS SingularManager.customerUserId()
   */
  async getCustomerUserId(): Promise<string> {
    // Try to get stored value first
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY_CUSTOMER_USER_ID);
      if (stored && stored.length > 0) {
        return stored;
      }
    } catch {
      // Ignore errors
    }

    // Get IDFV (iOS) or generate UUID (Android)
    let customerUserId: string;
    if (Platform.OS === 'ios') {
      customerUserId = (await Application.getIosIdForVendorAsync()) ?? this.generateUUID();
    } else {
      // Android doesn't have IDFV, use a persistent UUID
      customerUserId = this.generateUUID();
    }

    // Store for future use
    try {
      await SecureStore.setItemAsync(STORAGE_KEY_CUSTOMER_USER_ID, customerUserId);
    } catch {
      // Ignore errors
    }

    return customerUserId;
  }

  /**
   * Step 1: Start Singular session with customerUserId.
   * Equivalent to iOS SingularManager.startSession(customerUserId:)
   */
  startSession(config: SingularSessionConfig): boolean {
    const trimmedKey = config.singularApiKey?.trim();
    const trimmedSecret = config.singularSecret?.trim();

    if (!trimmedKey || !trimmedSecret) {
      return false;
    }

    this.singularConfig = new SingularConfig(trimmedKey, trimmedSecret);
    this.singularConfig.withSkAdNetworkEnabled(true);

    // iOS: Wait for App Tracking Transparency prompt
    if (Platform.OS === 'ios') {
      this.singularConfig.withWaitForTrackingAuthorizationWithTimeoutInterval(
        ATT_TIMEOUT_SECONDS,
      );

      // Clipboard attribution for Google Ads ODM (default: true)
      if (config.clipboardAttribution !== false) {
        this.singularConfig.withClipboardAttribution();
      }
    }

    // Branded domains for Singular Links
    if (config.brandedDomains && config.brandedDomains.length > 0) {
      this.singularConfig.withEspDomains(config.brandedDomains);
    }

    // Singular Links handler (deep links)
    if (config.singularLinksHandler) {
      this.singularConfig.withSingularLink((params: unknown) => {
        const linkParams = this.parseSingularLinkParams(params);
        config.singularLinksHandler?.(linkParams);
        if (linkParams) {
          this.emit({ type: 'deep_link_received', params: linkParams });
        }
      });
    }

    // Device attribution callback
    if (config.deviceAttributionCallback) {
      this.singularConfig.withDeviceAttributionCallback((data: unknown) => {
        const attributionData = data as DeviceAttributionData | null;
        config.deviceAttributionCallback?.(attributionData);
        if (attributionData) {
          this.emit({ type: 'attribution_received', data: attributionData });
        }
      });
    }

    // SKAN conversion value callback (iOS only)
    if (Platform.OS === 'ios') {
      this.singularConfig.withConversionValueUpdatedHandler(
        (conversionValue: number) => {
          if (__DEV__) {
            console.log('[GMSingular] SKAN conversion value updated:', conversionValue);
          }
        },
      );
    }

    // Set custom user ID if provided
    if (config.customUserId) {
      Singular.setCustomUserId(config.customUserId);
    }

    this.emit({ type: 'session_configured' });
    return true;
  }

  /**
   * Step 2: Request ATT permission and start Singular session.
   * Equivalent to iOS SingularManager.requestATT()
   */
  async requestATT(): Promise<TrackingAuthorizationStatus> {
    if (!this.singularConfig) {
      throw new GMSingularError(
        'Must call startSession() before requestATT()',
        GMSingularErrorCode.MissingConfiguration,
      );
    }

    let status: TrackingAuthorizationStatus = 'unavailable';

    // Request ATT permission on iOS
    if (Platform.OS === 'ios') {
      try {
        const { status: permissionStatus } = await requestTrackingPermissionsAsync();
        status = this.mapPermissionStatus(permissionStatus);
      } catch (error) {
        if (__DEV__) {
          console.warn('[GMSingular] ATT request failed:', error);
        }
        status = 'unavailable';
      }
    }

    // Start Singular SDK
    if (!this.isStarted) {
      Singular.init(this.singularConfig);
      Singular.event('app_open');
      this.isStarted = true;
      this.emit({ type: 'session_started' });
    }

    this.emit({ type: 'tracking_authorized', status });
    return status;
  }

  /**
   * Step 3: Register the app user with Going Merry backend.
   * Equivalent to iOS SingularManager.initialize(customerUserId:)
   */
  async initialize(params: InitializeParams): Promise<AppUserResponse> {
    const {
      applicationId,
      adaptyId,
      forceRefresh = false,
    } = params;

    if (!applicationId?.trim()) {
      throw new GMSingularError(
        'applicationId is required',
        GMSingularErrorCode.MissingApplicationId,
      );
    }

    // Get customerUserId (IDFV)
    const customerUserId = await this.getCustomerUserId();

    // Check if we need to force refresh
    let shouldRefresh = forceRefresh;
    if (!shouldRefresh) {
      const cached = await this.loadStoredAppUser();
      if (cached) {
        // Check if customUserId or adaptyId changed
        const storedCustomUserId = cached.customUserId;
        const storedAdaptyId = cached.adaptyId;

        if (customerUserId !== storedCustomUserId || adaptyId !== storedAdaptyId) {
          shouldRefresh = true;
        } else {
          // Use cached value
          if (cached.customUserId) {
            Singular.setCustomUserId(cached.customUserId);
          }
          return cached;
        }
      } else {
        shouldRefresh = true;
      }
    }

    const osVersion = String(Platform.Version);

    // Build request - singularDeviceId is the customerUserId (IDFV)
    const request: CreateAppUserRequest = {
      customUserId: customerUserId,
      adaptyId,
      deviceId: customerUserId,
      singularDeviceId: customerUserId,
      appStoreCountry: undefined, // TODO: Get from store
      appVersion: Application.nativeApplicationVersion ?? undefined,
      iosVersion: Platform.OS === 'ios' ? osVersion : undefined,
      androidVersion: Platform.OS === 'android' ? osVersion : undefined,
    };

    const appUser = await createAppUser(request, applicationId.trim(), DEFAULT_BACKEND_URL);

    // Persist to secure storage
    await this.persistAppUser(appUser);
    this.cachedAppUser = appUser;

    // Set custom user ID on Singular for attribution
    if (appUser.customUserId) {
      Singular.setCustomUserId(appUser.customUserId);
    }

    this.emit({ type: 'user_registered', user: appUser });
    return appUser;
  }

  /**
   * Get current ATT status without requesting permission.
   */
  async getTrackingAuthorizationStatus(): Promise<TrackingAuthorizationStatus> {
    if (Platform.OS !== 'ios') {
      return 'unavailable';
    }

    try {
      const { status } = await getTrackingPermissionsAsync();
      return this.mapPermissionStatus(status);
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Get the current app user from cache or storage (no network request).
   */
  async currentAppUser(): Promise<AppUserResponse | null> {
    if (this.cachedAppUser) {
      return this.cachedAppUser;
    }
    return this.loadStoredAppUser();
  }

  /**
   * Get the current app user (sync, from memory cache only).
   */
  getAppUser(): AppUserResponse | null {
    return this.cachedAppUser;
  }

  /**
   * Get the saved custom user ID.
   */
  async savedCustomUserId(): Promise<string | undefined> {
    const appUser = await this.currentAppUser();
    return appUser?.customUserId;
  }

  /**
   * Get the saved Adapty ID.
   */
  async savedAdaptyId(): Promise<string | undefined> {
    const appUser = await this.currentAppUser();
    return appUser?.adaptyId;
  }

  /**
   * Get the saved Singular device ID.
   */
  async savedSingularDeviceId(): Promise<string | undefined> {
    const appUser = await this.currentAppUser();
    return appUser?.singularDeviceId;
  }

  /**
   * Clear stored app user data (both memory and persistent cache).
   */
  async clearStoredAppUser(): Promise<void> {
    this.cachedAppUser = null;
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY_APP_USER);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Track a custom event.
   */
  trackEvent(eventName: string, args?: Record<string, string | number | boolean | null>): void {
    if (args) {
      Singular.eventWithArgs(eventName, args);
    } else {
      Singular.event(eventName);
    }
  }

  /**
   * Track a revenue event.
   */
  trackRevenue(
    eventName: string,
    currency: string,
    amount: number,
    args?: Record<string, string | number | boolean | null>,
  ): void {
    if (args) {
      Singular.customRevenueWithArgs(eventName, currency, amount, args);
    } else {
      Singular.customRevenue(eventName, currency, amount);
    }
  }

  /**
   * Set custom user ID directly on Singular.
   */
  setCustomUserId(userId: string): void {
    Singular.setCustomUserId(userId);
  }

  /**
   * Unset custom user ID (for logout).
   */
  unsetCustomUserId(): void {
    Singular.unsetCustomUserId();
    this.cachedAppUser = null;
  }

  /**
   * Set global property that will be sent with all events.
   */
  setGlobalProperty(key: string, value: string, overrideExisting = true): boolean {
    return Singular.setGlobalProperty(key, value, overrideExisting);
  }

  /**
   * Unset a global property.
   */
  unsetGlobalProperty(key: string): void {
    Singular.unsetGlobalProperty(key);
  }

  /**
   * Clear all global properties.
   */
  clearGlobalProperties(): void {
    Singular.clearGlobalProperties();
  }

  /**
   * GDPR: Stop all tracking.
   */
  stopAllTracking(): void {
    Singular.stopAllTracking();
  }

  /**
   * GDPR: Resume tracking after stopAllTracking.
   */
  resumeAllTracking(): void {
    Singular.resumeAllTracking();
  }

  /**
   * GDPR: Check if tracking is stopped.
   */
  isAllTrackingStopped(): boolean {
    return Singular.isAllTrackingStopped();
  }

  /**
   * CCPA/GDPR: Limit data sharing.
   */
  limitDataSharing(shouldLimit: boolean): void {
    Singular.limitDataSharing(shouldLimit);
  }

  /**
   * Get data sharing limit status.
   */
  getLimitDataSharing(): boolean {
    return Singular.getLimitDataSharing();
  }

  /**
   * GDPR: Opt in to tracking.
   */
  trackingOptIn(): void {
    Singular.trackingOptIn();
  }

  /**
   * Subscribe to events.
   */
  subscribe(listener: (event: GMSingularEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Check if session is started.
   */
  isSessionStarted(): boolean {
    return this.isStarted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async persistAppUser(appUser: AppUserResponse): Promise<void> {
    try {
      const json = JSON.stringify(appUser);
      await SecureStore.setItemAsync(STORAGE_KEY_APP_USER, json);
    } catch (error) {
      if (__DEV__) {
        console.warn('[GMSingular] Failed to persist app user:', error);
      }
    }
  }

  private async loadStoredAppUser(): Promise<AppUserResponse | null> {
    if (this.cachedAppUser) {
      return this.cachedAppUser;
    }

    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEY_APP_USER);
      if (json) {
        const appUser = JSON.parse(json) as AppUserResponse;
        this.cachedAppUser = appUser;
        return appUser;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[GMSingular] Failed to load stored app user:', error);
      }
    }
    return null;
  }

  private mapPermissionStatus(status: PermissionStatus): TrackingAuthorizationStatus {
    switch (status) {
      case PermissionStatus.GRANTED:
        return 'authorized';
      case PermissionStatus.DENIED:
        return 'denied';
      case PermissionStatus.UNDETERMINED:
        return 'not-determined';
      default:
        return 'unavailable';
    }
  }

  private parseSingularLinkParams(params: unknown): SingularLinkParams | null {
    if (!params || typeof params !== 'object') {
      return null;
    }

    const p = params as Record<string, unknown>;
    return {
      deepLink: typeof p.deeplink === 'string' ? p.deeplink : null,
      passthrough: typeof p.passthrough === 'string' ? p.passthrough : null,
      isDeferred: Boolean(p.isDeferred),
      urlParameters:
        typeof p.urlParameters === 'object' && p.urlParameters !== null
          ? (p.urlParameters as Record<string, string>)
          : {},
    };
  }

  private emit(event: GMSingularEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        if (__DEV__) {
          console.error('[GMSingular] Event listener error:', error);
        }
      }
    });
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const singularService = new GMSingularService();
