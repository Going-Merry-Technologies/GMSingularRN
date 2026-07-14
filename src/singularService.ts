import Singular, { SingularConfig } from 'singular-react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { createAppUser } from './api';
import type {
  GMSingularConfig,
  GMSingularEvent,
  AppUserResponse,
  CreateAppUserRequest,
} from './types';

const DEFAULT_BACKEND_URL = 'https://events.goingmerry.xyz';
const ATT_TIMEOUT_SECONDS = 300; // 5 minutes

/**
 * GMSingularService - Wrapper around Singular SDK for React Native.
 * Equivalent to GMSingularClient in the iOS SDK.
 */
class GMSingularService {
  private config: GMSingularConfig | null = null;
  private singularConfig: SingularConfig | null = null;
  private appUser: AppUserResponse | null = null;
  private isStarted = false;
  private eventListeners: ((event: GMSingularEvent) => void)[] = [];

  /**
   * Step 1: Configure the Singular SDK (does not start it yet).
   */
  configure(config: GMSingularConfig): void {
    this.config = config;

    this.singularConfig = new SingularConfig(config.apiKey, config.apiSecret);
    this.singularConfig.withSkAdNetworkEnabled(true);

    // iOS: Wait for App Tracking Transparency prompt
    if (Platform.OS === 'ios') {
      this.singularConfig.withWaitForTrackingAuthorizationWithTimeoutInterval(
        ATT_TIMEOUT_SECONDS,
      );
    }

    this.emit({ type: 'configured' });
  }

  /**
   * Step 2: Start the Singular session.
   * On iOS, this should be called after ATT prompt.
   */
  startSession(): void {
    if (!this.singularConfig) {
      throw new Error('GMSingular: Must call configure() before startSession()');
    }

    if (this.isStarted) {
      return;
    }

    Singular.init(this.singularConfig);
    this.isStarted = true;
    this.emit({ type: 'session_started' });
  }

  /**
   * Step 3: Register the app user with Going Merry backend.
   * This correlates Singular attribution with Adapty subscriptions.
   */
  async initialize(adaptyId?: string): Promise<AppUserResponse> {
    if (!this.config) {
      throw new Error('GMSingular: Must call configure() before initialize()');
    }

    const singularDeviceId = await this.getDeviceId();
    const backendUrl = this.config.backendUrl ?? DEFAULT_BACKEND_URL;

    const request: CreateAppUserRequest = {
      singularDeviceId,
      adaptyId,
      appVersion: Application.nativeApplicationVersion ?? undefined,
      ...(Platform.OS === 'ios'
        ? { iosVersion: Platform.Version.toString() }
        : { androidVersion: Platform.Version.toString() }),
    };

    this.appUser = await createAppUser(request, backendUrl);

    // Set custom user ID on Singular for attribution
    if (this.appUser.customUserId) {
      Singular.setCustomUserId(this.appUser.customUserId);
    }

    this.emit({ type: 'user_registered', user: this.appUser });
    return this.appUser;
  }

  /**
   * Get the Singular device ID.
   */
  async getDeviceId(): Promise<string> {
    return new Promise((resolve) => {
      Singular.getSingularDeviceId((deviceId) => {
        resolve(deviceId);
      });
    });
  }

  /**
   * Get the current app user (cached).
   */
  getAppUser(): AppUserResponse | null {
    return this.appUser;
  }

  /**
   * Get the custom user ID.
   */
  getCustomUserId(): string | undefined {
    return this.appUser?.customUserId;
  }

  /**
   * Track a custom event.
   */
  trackEvent(eventName: string, args?: Record<string, unknown>): void {
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
    args?: Record<string, unknown>,
  ): void {
    Singular.customRevenue(eventName, currency, amount, args);
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
    this.appUser = null;
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

  private emit(event: GMSingularEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}

export const singularService = new GMSingularService();
