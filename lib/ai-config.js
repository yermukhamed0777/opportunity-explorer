// Capability only: credentials never leave the server.
export function isGatewayConfigured(env = process.env) {
  return !!(
    env.AI_GATEWAY_MODEL &&
    (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN)
  );
}
