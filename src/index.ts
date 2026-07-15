// Service
export { singularService } from './singularService';

// API
export { createAppUser, getAppUser } from './api';

// Hooks
export {
  useSingularEngine,
  useAppUser,
  useCustomUserId,
  useSingularDeviceId,
  useTrackEvent,
  useTrackingAuthorizationStatus,
  useSingularEvents,
  useGDPRControls,
  useDataSharingControls,
  useGlobalProperties,
} from './hooks';

// Types
export type {
  SingularSessionConfig,
  InitializeParams,
  GMSingularEvent,
  CreateAppUserRequest,
  AppUserResponse,
  TrackingAuthorizationStatus,
  SingularLinkParams,
  DeviceAttributionData,
} from './types';

export { GMSingularError, GMSingularErrorCode } from './types';
