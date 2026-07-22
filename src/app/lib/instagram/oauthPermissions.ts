export const INSTAGRAM_OAUTH_PERMISSIONS = [
  "public_profile",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
] as const;

export const INSTAGRAM_OAUTH_SCOPE = INSTAGRAM_OAUTH_PERMISSIONS.join(",");
