import { Platform } from "./platform";

const getStripeSecretKey = (platform: Platform): string | null => {
  let key;

  switch (platform) {
    case Platform.UK:
      key = process.env.STRIPE_SECRET_KEY_UK;
      break;
    case Platform.EU:
      key = process.env.STRIPE_SECRET_KEY_EU;
      break;
    case Platform.US:
      key = process.env.STRIPE_SECRET_KEY_US;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return key || null;
};

const getStripePublishableKey = (platform: Platform): string | null => {
  let key;

  switch (platform) {
    case Platform.UK:
      key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_UK;
      break;
    case Platform.EU:
      key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_EU;
      break;
    case Platform.US:
      key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_US;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return key || null;
};

export { getStripeSecretKey, getStripePublishableKey };
