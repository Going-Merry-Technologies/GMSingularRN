import type { CreateAppUserRequest, AppUserResponse, GMSingularErrorCode } from './types';
import { GMSingularError } from './types';

const DEFAULT_BACKEND_URL = 'https://events.goingmerry.xyz';

/**
 * Creates/registers an app user with the Going Merry backend.
 * This correlates Singular attribution data with Adapty subscription data.
 */
export async function createAppUser(
  request: CreateAppUserRequest,
  applicationId: string,
  backendUrl: string = DEFAULT_BACKEND_URL,
): Promise<AppUserResponse> {
  const url = `${backendUrl.replace(/\/+$/, '')}/v1/app-users`;

  const trimmedAppId = applicationId.trim();
  if (!trimmedAppId) {
    throw new GMSingularError(
      'Application ID is required',
      'MISSING_CONFIGURATION' as GMSingularErrorCode,
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${trimmedAppId}`,
    },
    body: JSON.stringify({
      custom_user_id: request.customUserId,
      adapty_id: request.adaptyId,
      device_id: request.deviceId,
      singular_device_id: request.singularDeviceId,
      app_store_country: request.appStoreCountry,
      app_version: request.appVersion,
      iOS_version: request.iosVersion,
      android_version: request.androidVersion,
    }),
  });

  if (!response.ok) {
    throw new GMSingularError(
      `Failed to create app user: ${response.statusText}`,
      'INVALID_STATUS_CODE' as GMSingularErrorCode,
      response.status,
    );
  }

  const data = await response.json();

  // Map snake_case response to camelCase
  return {
    applicationId: data.application_id,
    customUserId: data.custom_user_id,
    adaptyId: data.adapty_id,
    deviceId: data.device_id,
    singularDeviceId: data.singular_device_id,
    appStoreCountry: data.app_store_country,
    appVersion: data.app_version,
    iosVersion: data.iOS_version,
    androidVersion: data.android_version,
  };
}

/**
 * Fetches an existing app user from the Going Merry backend.
 */
export async function getAppUser(
  customUserId: string,
  applicationId: string,
  backendUrl: string = DEFAULT_BACKEND_URL,
): Promise<AppUserResponse | null> {
  const url = `${backendUrl.replace(/\/+$/, '')}/v1/app-users/${encodeURIComponent(customUserId)}`;

  const trimmedAppId = applicationId.trim();
  if (!trimmedAppId) {
    throw new GMSingularError(
      'Application ID is required',
      'MISSING_CONFIGURATION' as GMSingularErrorCode,
    );
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${trimmedAppId}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new GMSingularError(
      `Failed to get app user: ${response.statusText}`,
      'INVALID_STATUS_CODE' as GMSingularErrorCode,
      response.status,
    );
  }

  const data = await response.json();

  // Map snake_case response to camelCase
  return {
    applicationId: data.application_id,
    customUserId: data.custom_user_id,
    adaptyId: data.adapty_id,
    deviceId: data.device_id,
    singularDeviceId: data.singular_device_id,
    appStoreCountry: data.app_store_country,
    appVersion: data.app_version,
    iosVersion: data.iOS_version,
    androidVersion: data.android_version,
  };
}
