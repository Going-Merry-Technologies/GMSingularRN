# GMSingularRN

Going Merry Singular SDK wrapper for React Native. Provides attribution tracking and user registration with the Going Merry backend.

## Installation

```bash
npm install github:Going-Merry-Technologies/GMSingularRN
```

### Peer Dependencies

```bash
npx expo install singular-react-native expo-application @tanstack/react-query
npx expo prebuild
```

## Usage

### 1. Initialize in Root Layout

```typescript
import { useSingularEngine } from '@goingmerry/gm-singular-rn';

function App() {
  useSingularEngine({
    apiKey: process.env.EXPO_PUBLIC_SINGULAR_API_KEY!,
    apiSecret: process.env.EXPO_PUBLIC_SINGULAR_API_SECRET!,
    backendUrl: 'https://events.goingmerry.xyz', // optional
  });

  return <YourApp />;
}
```

### 2. Access App User

```typescript
import { useAppUser, useCustomUserId } from '@goingmerry/gm-singular-rn';

function MyComponent() {
  const { data: appUser } = useAppUser();
  const customUserId = useCustomUserId();

  // Use customUserId for Adapty integration
}
```

### 3. Track Events

```typescript
import { useTrackEvent } from '@goingmerry/gm-singular-rn';

function MyComponent() {
  const { trackEvent, trackRevenue } = useTrackEvent();

  const handlePurchase = () => {
    trackRevenue('purchase', 'USD', 9.99, { product_id: 'premium' });
  };

  const handleAction = () => {
    trackEvent('button_clicked', { screen: 'home' });
  };
}
```

## API

### `singularService`

- `configure(config)` - Configure the SDK
- `startSession()` - Start Singular session
- `initialize(adaptyId?)` - Register with Going Merry backend
- `getAppUser()` - Get cached app user
- `getCustomUserId()` - Get custom user ID
- `trackEvent(name, args?)` - Track custom event
- `trackRevenue(name, currency, amount, args?)` - Track revenue

### Hooks

- `useSingularEngine(config)` - Initialize SDK (use once in root)
- `useAppUser()` - Query hook for app user
- `useCustomUserId()` - Get custom user ID
- `useTrackEvent()` - Get tracking functions

## License

MIT
