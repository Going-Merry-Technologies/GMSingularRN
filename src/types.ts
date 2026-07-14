/**
 * Request to create/register an app user with Going Merry backend
 */
export interface CreateAppUserRequest {
  customUserId?: string;
  adaptyId?: string;
  deviceId?: string;
  singularDeviceId?: string;
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
  deviceId?: string;
  singularDeviceId?: string;
  appStoreCountry?: string;
  appVersion?: string;
  iosVersion?: string;
  androidVersion?: string;
}

/**
 * Configuration for GMSingular SDK
 */
export interface GMSingularConfig {
  apiKey: string;
  apiSecret: string;
  backendUrl?: string;
}

/**
 * Events emitted by GMSingular
 */
export type GMSingularEvent =
  | { type: 'configured' }
  | { type: 'session_started' }
  | { type: 'user_registered'; user: AppUserResponse }
  | { type: 'error'; error: Error };
