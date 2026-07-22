import {
  INSTAGRAM_OAUTH_PERMISSIONS,
  INSTAGRAM_OAUTH_SCOPE,
} from "./oauthPermissions";

describe("Instagram OAuth permissions", () => {
  it("solicita apenas as permissões demonstradas na revisão Meta", () => {
    expect(INSTAGRAM_OAUTH_PERMISSIONS).toEqual([
      "public_profile",
      "pages_show_list",
      "instagram_basic",
      "instagram_manage_insights",
      "business_management",
    ]);
    expect(INSTAGRAM_OAUTH_SCOPE).not.toContain("email");
    expect(INSTAGRAM_OAUTH_SCOPE).not.toContain("pages_read_engagement");
    expect(INSTAGRAM_OAUTH_SCOPE).not.toContain("instagram_manage_comments");
  });
});
