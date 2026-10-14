// Fixed endpoints. Everything is the same Supabase project the website and the apps use.
export const SUPABASE_URL = "https://puokewpqhparawdcwkbw.supabase.co";
export const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;
export const ASSIST_URL = `${SUPABASE_URL}/functions/v1/shop-assist`;
export const AUTHORIZE_URL = `${SUPABASE_URL}/auth/v1/oauth/authorize`;
export const TOKEN_URL = `${SUPABASE_URL}/auth/v1/oauth/token`;
export const USERINFO_URL = `${SUPABASE_URL}/auth/v1/oauth/userinfo`;
/** Public OAuth client registered for this extension (PKCE, no secret). */
export const OAUTH_CLIENT_ID = "1c76f628-c1af-4f4e-aaae-afa37ca6fb72";
export const WEBSITE_URL = "https://airecipemanager.com";
/** Name shown in the AI consent switch. Matches the website's consent dialog. */
export const AI_PROVIDER_LABEL = "Google Gemini (through OpenRouter)";
