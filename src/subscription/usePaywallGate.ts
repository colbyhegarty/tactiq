import { useCallback, useState } from 'react';
import { useSubscription } from './SubscriptionContext';
import { GatedFeature } from '../types/subscription';
import { track } from '../lib/analytics';

export function usePaywallGate() {
  const { checkEntitlement } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>();
  const [paywallFeature, setPaywallFeature] = useState<GatedFeature | undefined>();

  const gate = useCallback(
    async (feature: GatedFeature): Promise<boolean> => {
      const result = await checkEntitlement(feature);
      if (result.allowed) return true;

      track('paywall_shown', { trigger: feature, reason: result.reason });
      setPaywallReason(result.reason);
      setPaywallFeature(feature);
      setPaywallVisible(true);
      return false;
    },
    [checkEntitlement],
  );

  const dismissPaywall = useCallback(() => {
    if (paywallFeature) {
      track('paywall_dismissed', { trigger: paywallFeature });
    }
    setPaywallVisible(false);
    setPaywallReason(undefined);
    setPaywallFeature(undefined);
  }, [paywallFeature]);

  return {
    gate,
    paywallVisible,
    paywallReason,
    paywallFeature,
    dismissPaywall,
  };
}
