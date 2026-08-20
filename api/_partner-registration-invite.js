const crypto = require("crypto");
const { supabaseRequest } = require("./_shared");

const INVITE_TTL_SECONDS = 14 * 24 * 60 * 60;

function partnerInviteConfigured() {
  return process.env.PARTNER_INVITE_ENFORCEMENT !== "disabled";
}

function partnerInviteTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

function issuePartnerRegistrationInvite(application, nowSeconds = Math.floor(Date.now() / 1000)) {
  const applicationId = String(application.id || "");
  const email = String(application.contact_email || application.contactEmail || "").trim().toLowerCase();
  if (!applicationId || !email) throw new Error("Partner application is incomplete");
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: partnerInviteTokenHash(token),
    applicationId,
    email,
    expiresAt: new Date((nowSeconds + INVITE_TTL_SECONDS) * 1000).toISOString(),
  };
}

async function findActivePartnerRegistrationInvitation(token) {
  if (!partnerInviteConfigured() || !token) return null;
  const rows = await supabaseRequest("partner_registration_invitations", {
    query: `?select=*&token_hash=eq.${encodeURIComponent(partnerInviteTokenHash(token))}&status=eq.pending&limit=1`,
  });
  const invitation = rows[0];
  if (!invitation) return null;
  if (new Date(invitation.expires_at).getTime() > Date.now()) return invitation;
  await supabaseRequest("partner_registration_invitations", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(invitation.id)}&status=eq.pending`,
    body: {
      status: "expired",
      updated_at: new Date().toISOString(),
    },
  }).catch(() => null);
  return null;
}

module.exports = {
  INVITE_TTL_SECONDS,
  findActivePartnerRegistrationInvitation,
  issuePartnerRegistrationInvite,
  partnerInviteConfigured,
  partnerInviteTokenHash,
};
