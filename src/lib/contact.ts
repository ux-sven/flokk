// Offentlige kontaktpunkter, brukt på /hjelp, /om og /personvern og i App Store Connect.

/** Support-adressen (vises offentlig). Kan overstyres med NEXT_PUBLIC_SUPPORT_EMAIL. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "svenway+support@gmail.com";

/** Flokk i App Store (virker når appen er publisert). */
export const APP_STORE_URL = "https://apps.apple.com/app/id6835577996";
