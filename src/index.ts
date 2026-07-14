// Service
export { singularService } from './singularService';

// API
export { createAppUser, getAppUser, GMSingularApiError } from './api';

// Hooks
export {
  useSingularEngine,
  useAppUser,
  useCustomUserId,
  useTrackEvent,
} from './hooks';

// Types
export type {
  GMSingularConfig,
  GMSingularEvent,
  CreateAppUserRequest,
  AppUserResponse,
} from './types';
