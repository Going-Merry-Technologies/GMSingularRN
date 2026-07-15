/**
 * Tracking Authorization Status (iOS 14+ ATT)
 */
export type TrackingAuthorizationStatus =
  | 'not-determined'
  | 'restricted'
  | 'denied'
  | 'authorized'
  | 'unavailable';

/**
 * Singular Link Parameters (deep link data)
 */
export interface SingularLinkParams {
  deepLink: string | null;
  passthrough: string | null;
  isDeferred: boolean;
  urlParameters: Record<string, string>;
}

/**
 * Device Attribution Data
 */
export type DeviceAttributionData = Record<string, unknown>;

/**
 * Configuration for startSingularSession()
 * Matches iOS GMSingularClient.startSingularSession() parameters
 */
export interface SingularSessionConfig {
  /** Singular API key */
  singularApiKey: string;
  /** Singular API secret */
  singularSecret: string;
  /** Custom user ID to set on Singular */
  customUserId?: string;
  /** Enable SDK logging (default: true) */
  enableLogging?: boolean;
  /** Enable clipboard attribution for Google Ads ODM (default: true, iOS only) */
  clipboardAttribution?: boolean;
  /** Branded domains for Singular Links (e.g., ["brand.sng.link"]) */
  brandedDomains?: string[];
  /** Callback when Singular Link is resolved (deep links) */
  singularLinksHandler?: (params: SingularLinkParams | null) => void;
  /** Callback when device attribution data is available */
  deviceAttributionCallback?: (data: DeviceAttributionData | null) => void;
}

/**
 * Parameters for initialize() method
 * Matches iOS GMSingularClient.initialize() parameters
 */
export interface InitializeParams {
  /** Going Merry application ID (required) */
  applicationId: string;
  /** Custom user ID (should match adaptyId for consistency) */
  customUserId?: string;
  /** Adapty profile ID */
  adaptyId?: string;
  /** Device identifier (auto-generated if not provided) */
  deviceId?: string;
  /** Singular device ID (auto-resolved from SDK if not provided) */
  singularDeviceId?: string;
  /** App Store country code (e.g., "US", "BR") */
  appStoreCountry?: string;
  /** App version (auto-resolved if not provided) */
  appVersion?: string;
  /** iOS version (auto-resolved if not provided) */
  iosVersion?: string;
  /** Android version (auto-resolved if not provided) */
  androidVersion?: string;
  /** Force refresh from server, bypassing cache */
  forceRefresh?: boolean;
}

/**
 * Request to create/register an app user with Going Merry backend
 */
export interface CreateAppUserRequest {
  customUserId?: string;
  adaptyId?: string;
  deviceId: string;
  singularDeviceId: string;
  appStoreCountry?: string;
  appVersion?: string;
  iosVersion?: string;
  androidVersion?: string;
}

/**
 * Response from Going Merry backend after registering app user
 */
export interface AppUserResponse {
  applicationId: string;
  customUserId: string;
  adaptyId?: string;
  deviceId: string;
  singularDeviceId: string;
  appStoreCountry?: string;
  appVersion?: string;
  iosVersion?: string;
  androidVersion?: string;
}

/**
 * GMSingular Error types
 */
export enum GMSingularErrorCode {
  MissingConfiguration = 'MISSING_CONFIGURATION',
  MissingSingularDeviceId = 'MISSING_SINGULAR_DEVICE_ID',
  MissingApplicationId = 'MISSING_APPLICATION_ID',
  NetworkError = 'NETWORK_ERROR',
  EncodingError = 'ENCODING_ERROR',
  DecodingError = 'DECODING_ERROR',
  StorageError = 'STORAGE_ERROR',
  InvalidStatusCode = 'INVALID_STATUS_CODE',
}

export class GMSingularError extends Error {
  constructor(
    message: string,
    public readonly code: GMSingularErrorCode,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'GMSingularError';
  }
}

/**
 * Events emitted by GMSingular
 */
export type GMSingularEvent =
  | { type: 'session_configured' }
  | { type: 'session_started' }
  | { type: 'tracking_authorized'; status: TrackingAuthorizationStatus }
  | { type: 'singular_id_ready'; singularDeviceId: string }
  | { type: 'user_registered'; user: AppUserResponse }
  | { type: 'deep_link_received'; params: SingularLinkParams }
  | { type: 'attribution_received'; data: DeviceAttributionData }
  | { type: 'error'; error: Error };
