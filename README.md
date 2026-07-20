# GMSingular React Native SDK

Singular SDK wrapper for React Native, equivalent to `GMSingularClient` on iOS.

## Installation

```bash
npm install github:Going-Merry-Technologies/GMSingularRN
```

### Peer Dependencies

```bash
npx expo install singular-react-native expo-secure-store expo-tracking-transparency expo-application @tanstack/react-query
npx expo prebuild
```

## Usage

### Initialization Flow

The SDK follows the same flow as the native iOS SDK:

```
1. startSingularSession()     → Configure Singular SDK
2. requestTrackingAuthorizationAndStartSingularSession() → Request ATT and start session
3. initialize()               → Register user with Going Merry backend
```

### Complete Example

```typescript
import { singularService } from '@goingmerry/gm-singular-rn';
import type { SingularSessionConfig, InitializeParams } from '@goingmerry/gm-singular-rn';

// Step 1: Configure Singular (call early in app lifecycle)
const sessionConfig: SingularSessionConfig = {
  singularApiKey: 'YOUR_API_KEY',
  singularSecret: 'YOUR_SECRET',
  customUserId: userId,
  clipboardAttribution: true, // Google Ads ODM (iOS)
  brandedDomains: ['app.sng.link'],
  singularLinksHandler: (params) => {
    console.log('Deep link received:', params?.deepLink);
  },
  deviceAttributionCallback: (data) => {
    console.log('Attribution data:', data);
    // Forward to Adapty: Adapty.updateAttribution(data, 'singular');
  },
};

singularService.startSingularSession(sessionConfig);

// Step 2: Request ATT and start session
const trackingStatus = await singularService.requestTrackingAuthorizationAndStartSingularSession();
console.log('ATT Status:', trackingStatus); // 'authorized' | 'denied' | 'not-determined' | 'restricted' | 'unavailable'

// Step 3: Register user with Going Merry backend
const initParams: InitializeParams = {
  applicationId: 'YOUR_GM_APP_ID',
  customUserId: userId,
  adaptyId: adaptyProfileId, // Adapty profile ID
  appStoreCountry: 'US',
};

const appUser = await singularService.initialize(initParams);
console.log('App User registered:', appUser.customUserId);
```

### Using the Hook (Recommended)

```typescript
import { useSingularEngine } from '@goingmerry/gm-singular-rn';
import type { SingularSessionConfig, InitializeParams } from '@goingmerry/gm-singular-rn';

function App() {
  const sessionConfig: SingularSessionConfig = {
    singularApiKey: 'YOUR_API_KEY',
    singularSecret: 'YOUR_SECRET',
  };

  const initParams: InitializeParams = {
    applicationId: 'YOUR_GM_APP_ID',
    adaptyId: 'user-adapty-id',
  };

  const { isReady, trackingStatus, appUser, error } = useSingularEngine(
    sessionConfig,
    initParams,
  );

  if (error) {
    console.error('GMSingular error:', error);
  }

  if (!isReady) {
    return <LoadingScreen />;
  }

  return <MainApp />;
}
```

## API Reference

### `singularService.startSingularSession(config)`

Configures the Singular SDK. Must be called before `requestTrackingAuthorizationAndStartSingularSession()`.

**Parameters (`SingularSessionConfig`):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `singularApiKey` | `string` | Yes | Singular API key |
| `singularSecret` | `string` | Yes | Singular API secret |
| `customUserId` | `string` | No | User ID for attribution |
| `enableLogging` | `boolean` | No | Enable logging (default: `true`) |
| `clipboardAttribution` | `boolean` | No | Enable ODM for Google Ads (default: `true`, iOS only) |
| `brandedDomains` | `string[]` | No | Domains for Singular Links (e.g., `['app.sng.link']`) |
| `singularLinksHandler` | `(params) => void` | No | Callback for deep links |
| `deviceAttributionCallback` | `(data) => void` | No | Callback for attribution data |

**Returns:** `boolean` - `true` if configuration was successful

---

### `singularService.requestTrackingAuthorizationAndStartSingularSession()`

Requests ATT permission (iOS 14+) and starts the Singular session.

**Returns:** `Promise<TrackingAuthorizationStatus>`

```typescript
type TrackingAuthorizationStatus =
  | 'authorized'      // User authorized tracking
  | 'denied'          // User denied tracking
  | 'not-determined'  // User hasn't decided yet
  | 'restricted'      // Parental controls
  | 'unavailable';    // Android or iOS < 14
```

---

### `singularService.initialize(params)`

Registers the user with the Going Merry backend. Correlates Singular attribution with Adapty.

**Parameters (`InitializeParams`):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `applicationId` | `string` | Yes | Going Merry application ID |
| `customUserId` | `string` | No | Custom user identifier |
| `adaptyId` | `string` | No | Adapty profile ID |
| `deviceId` | `string` | No | Device identifier (auto-generated if not provided) |
| `singularDeviceId` | `string` | No | SDID (auto-resolved from SDK if not provided) |
| `appStoreCountry` | `string` | No | Country code (e.g., `'US'`, `'BR'`) |
| `appVersion` | `string` | No | App version (auto-resolved) |
| `forceRefresh` | `boolean` | No | Force refresh from server (default: `false`) |

**Returns:** `Promise<AppUserResponse>`

---

### Event Tracking

```typescript
// Simple event
singularService.trackEvent('tutorial_complete');

// Event with attributes
singularService.trackEvent('level_achieved', {
  level: 5,
  score: 1000,
});

// Revenue event
singularService.trackRevenue('purchase', 'USD', 9.99, {
  product_id: 'premium_monthly',
});
```

---

### Custom User ID

```typescript
// Set user ID
singularService.setCustomUserId('user-123');

// Remove ID (logout)
singularService.unsetCustomUserId();
```

---

### Global Properties

```typescript
// Add global property (sent with all events)
singularService.setGlobalProperty('user_tier', 'premium');

// Remove property
singularService.unsetGlobalProperty('user_tier');

// Clear all
singularService.clearGlobalProperties();
```

---

### GDPR / Privacy

```typescript
// Stop all tracking
singularService.stopAllTracking();

// Resume tracking
singularService.resumeAllTracking();

// Check if tracking is stopped
const isStopped = singularService.isAllTrackingStopped();

// Opt-in
singularService.trackingOptIn();

// CCPA: Limit data sharing
singularService.limitDataSharing(true);
const isLimited = singularService.getLimitDataSharing();
```

---

### Accessing User Data

```typescript
// Async (cache + storage)
const appUser = await singularService.currentAppUser();
const customUserId = await singularService.savedCustomUserId();
const adaptyId = await singularService.savedAdaptyId();
const singularDeviceId = await singularService.savedSingularDeviceId();

// Sync (memory only)
const appUserSync = singularService.getAppUser();
const customUserIdSync = singularService.getCustomUserId();

// Clear stored data
await singularService.clearStoredAppUser();
```

---

### SDK Status

```typescript
// Check if SDK is configured
const isConfigured = singularService.isConfigured();

// Check if session is started
const isStarted = singularService.isSessionStarted();

// Get current ATT status (without requesting)
const status = await singularService.getTrackingAuthorizationStatus();
```

---

## Available Hooks

| Hook | Description |
|------|-------------|
| `useSingularEngine` | Initializes the SDK (Steps 1-3) |
| `useAppUser` | Access current user (React Query) |
| `useCustomUserId` | Get custom user ID |
| `useSingularDeviceId` | Get Singular device ID |
| `useTrackEvent` | Event tracking functions |
| `useTrackingAuthorizationStatus` | Current ATT status |
| `useSingularEvents` | Subscribe to SDK events |
| `useGDPRControls` | GDPR controls |
| `useDataSharingControls` | CCPA controls |
| `useGlobalProperties` | Manage global properties |

---

## Comparison with iOS SDK

| iOS (`GMSingularClient`) | React Native (`singularService`) |
|--------------------------|----------------------------------|
| `startSingularSession()` | `startSingularSession()` |
| `requestTrackingAuthorizationAndStartSingularSession()` | `requestTrackingAuthorizationAndStartSingularSession()` |
| `initialize()` | `initialize()` |
| `currentAppUser()` | `currentAppUser()` |
| `savedCustomUserId()` | `savedCustomUserId()` |
| `savedSingularDeviceId()` | `savedSingularDeviceId()` |
| `savedAdaptyId()` | `savedAdaptyId()` |
| `clearStoredAppUser()` | `clearStoredAppUser()` |

---

## Persistence

- **Device ID**: Stored in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android)
- **Singular Device ID**: Retrieved from Singular SDK + cached in secure storage
- **App User**: Cached in secure storage

Persistence survives app reinstallation on iOS (via Keychain).

---

## Exported Types

```typescript
import type {
  SingularSessionConfig,
  InitializeParams,
  AppUserResponse,
  TrackingAuthorizationStatus,
  SingularLinkParams,
  DeviceAttributionData,
  GMSingularEvent,
  CreateAppUserRequest,
} from '@goingmerry/gm-singular-rn';

import { GMSingularError, GMSingularErrorCode } from '@goingmerry/gm-singular-rn';
```

## License

MIT
