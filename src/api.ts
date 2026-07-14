import type { CreateAppUserRequest, AppUserResponse } from './types';

const DEFAULT_BACKEND_URL = 'https://events.goingmerry.xyz';

export class GMSingularApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'GMSingularApiError';
  }
}

/**
 * Creates/registers an app user with the Going Merry backend.
 * This correlates Singular attribution data with Adapty subscription data.
 */
export async function createAppUser(
  request: CreateAppUserRequest,
  backendUrl: string = DEFAULT_BACKEND_URL,
): Promise<AppUserResponse> {
  const url = `${backendUrl.replace(/\/+$/, '')}/v1/app-users`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new GMSingularApiError(
      `Failed to create app user: ${response.statusText}`,
      response.status,
    );
  }

  const data = await response.json();
  return data as AppUserResponse;
}

/**
 * Fetches an existing app user from the Going Merry backend.
 */
export async function getAppUser(
  customUserId: string,
  backendUrl: string = DEFAULT_BACKEND_URL,
): Promise<AppUserResponse | null> {
  const url = `${backendUrl.replace(/\/+$/, '')}/v1/app-users/${encodeURIComponent(customUserId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new GMSingularApiError(
      `Failed to get app user: ${response.statusText}`,
      response.status,
    );
  }

  const data = await response.json();
  return data as AppUserResponse;
}
