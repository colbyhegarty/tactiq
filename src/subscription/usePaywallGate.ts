import { useCallback, useState } from 'react';
import { useSubscription } from './SubscriptionContext';
import { GatedFeature } from '../types/subscription';

/**
 * Hook that gates a user action behind a subscription check.
 *
 * Usage:
 *   const { gate, paywallVisible, paywallReason, dismissPaywall } = usePaywallGate();
 *
 *   const handleExport = async () => {
 *     const allowed = await gate('export_pdf');
 *     if (!allowed) return; // paywall was shown
 *     // ... proceed with export
 *   };
 */
export function usePaywallGate() {
  const { checkEntitlement } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>();
  const [paywallFeature, setPaywallFeature] = useState<GatedFeature | undefined>();

  const gate = useCallback(
    async (feature: GatedFeature): Promise<boolean> => {
      const result = await checkEntitlement(feature);
      if (result.allowed) return true;

      setPaywallReason(result.reason);
      setPaywallFeature(feature);
      setPaywallVisible(true);
      return false;
    },
    [checkEntitlement],
  );

  const dismissPaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallReason(undefined);
    setPaywallFeature(undefined);
  }, []);

  return {
    gate,
    paywallVisible,
    paywallReason,
    paywallFeature,
    dismissPaywall,
  };
}
