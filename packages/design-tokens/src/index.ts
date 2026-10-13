const shared = { primary: "#37469E", primaryDeep: "#313790", secondary: "#FF5C00", secondaryWarm: "#F05722", onPrimary: "#FFFFFF", onSecondary: "#201A16" };
export const lightColors = { ...shared, background: "#37469E", surface: "#FFFFFF", surfaceVariant: "#EDF0FF", onSurface: "#17204B", muted: "#566080", outline: "#C9CEE4", error: "#A32029", onError: "#FFFFFF", success: "#216644" };
export const darkColors = { ...shared, background: "#171C3C", surface: "#252D54", surfaceVariant: "#333F70", onSurface: "#F7F8FF", muted: "#CFD4EE", outline: "#6974A5", error: "#FFB3BA", onError: "#52161D", success: "#9DDABC" };
export type AppColors = { [K in keyof typeof lightColors]: string };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const typeScale = { display: 44, headline: 30, title: 22, body: 16, label: 14, caption: 12 };
