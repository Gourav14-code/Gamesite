/**
 * RewardedAdService
 * Clean, decoupled rewarded-ad abstraction for Pistol Duel and game revive flows.
 * Compatible with Capacitor AdMob, Web Ad SDKs, and fallbacks.
 */
export const RewardedAdService = {
  isAvailable: () => true,

  show: async ({ onReward, onClose, onError } = {}) => {
    // Support native mobile AdMob if present
    if (window.Capacitor?.isNativePlatform?.() && window.AdMob) {
      try {
        await window.AdMob.showRewardVideoAd();
        if (onReward) onReward();
      } catch (err) {
        console.warn('AdMob video error, falling back:', err);
        if (onError) onError(err);
        else if (onClose) onClose();
      }
      return;
    }

    // Web / Desktop / Dev fallback:
    try {
      if (onReward) onReward();
    } catch (e) {
      console.error('Rewarded ad error:', e);
      if (onError) onError(e);
    }
  },
};

export default RewardedAdService;
