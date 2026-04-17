# Tactiq Subscription System — File Placement Guide

Copy each file from this download into your repo at the path shown below.

## NEW FILES — create these directories/files

```
src-subscription/  →  src/subscription/
  index.ts
  SubscriptionContext.tsx
  PaywallModal.tsx
  ProBadge.tsx
  LockedDrillOverlay.tsx
  DevSubscriptionToggle.tsx
  usePaywallGate.ts
  freeDrillConfig.ts          ← Edit this to control which drills are free

src-types/  →  src/types/
  subscription.ts             ← Edit FREE_LIMITS here to change limits
```

## MODIFIED FILES — replace these existing files

```
app-root/  →  app/
  _layout.tsx                 ← Wraps app in SubscriptionProvider
  session-view.tsx            ← Export PDF + Share gated

app-tabs/  →  app/(tabs)/
  index.tsx                   ← Library: locked drills blurred + paywall
  sessions.tsx                ← Create session gated (1 max free)
  create.tsx                  ← Create custom drill gated (2 max free)
  profile.tsx                 ← PlanStatusCard + Go Pro button added

src-components/  →  src/components/
  DrillCard.tsx               ← New isLocked prop + LockedDrillOverlay
```

## PAYWALL TRIGGER MAP

| User Action                | Gate Feature         | Free Limit        |
|----------------------------|----------------------|-------------------|
| Tap locked drill in library| view_locked_drill    | Config file       |
| Create 2nd session         | create_session       | 1 session max     |
| Create 3rd custom drill    | create_custom_drill  | 2 drills max      |
| Export session PDF          | export_pdf           | Always blocked    |
| Share session to contacts  | share_session        | Always blocked    |

## FIRST STEPS AFTER ADDING FILES

1. Add drill IDs to `src/subscription/freeDrillConfig.ts`
2. Use the floating red/green DEV toggle to test free vs pro
3. Adjust limits in `src/types/subscription.ts` if needed
