const {
  sendJson,
  requireAdminRole,
  supabaseRequest,
  centerFromRow,
  createSignedStorageUrl,
  recordAuditLog,
  recordErrorLog,
} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  const admin = await requireAdminRole(req, res, ["super_admin", "admin", "support", "analyst"]);
  if (!admin) return;
  try {
    const [applications, partnerApplications, partnerInvitations, centerRows, events, ownerAccounts, ownerMemberships, reviews] = await Promise.all([
      supabaseRequest("center_applications", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("partner_applications", { query: "?select=*&order=created_at.desc&limit=500" }).catch(() => []),
      supabaseRequest("partner_registration_invitations", {
        query: "?select=id,partner_application_id,email,status,expires_at,sent_at,email_delivery_status,email_error,used_at,revoked_at,created_at&order=created_at.desc&limit=1000",
      }).catch(() => []),
      supabaseRequest("centers", { query: "?select=*&order=created_at.desc" }),
      supabaseRequest("events", { query: "?select=*&order=created_at.desc&limit=1000" }),
      supabaseRequest("center_owner_accounts", {
        query: "?select=id,center_id,email,status,last_login_at,created_at&order=created_at.desc",
      }).catch(() => []),
      supabaseRequest("center_memberships", {
        query: "?select=id,center_id,user_id,email,role,status,last_active_at,created_at&role=eq.owner&order=created_at.desc",
      }).catch(() => []),
      supabaseRequest("reviews", {
        query: "?select=id,center_id,user_id,nickname,rating,content,status,created_at,updated_at&order=created_at.desc&limit=250",
      }).catch(() => []),
    ]);
    const centers = await Promise.all(centerRows.map(async (row) => {
      const paths = row.photo_paths?.length ? row.photo_paths : (row.photo_path ? [row.photo_path] : []);
      const photoUrls = await Promise.all(paths.map((path) => createSignedStorageUrl(path)));
      const ownerMembership = ownerMemberships.find((membership) =>
        membership.center_id === row.id && membership.status === "active"
      );
      const legacyOwnerAccount = ownerAccounts.find((account) => account.center_id === row.id);
      const registration = applications.find((application) => application.id === row.application_id);
      return ({
        ...centerFromRow({ ...row, therapist_background: registration?.therapist_background === true }, photoUrls[0] || "", photoUrls),
        status: row.status || "approved",
        phone: row.phone || "",
        website: row.website || "",
        openingHours: row.opening_hours || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        registrationEmail: registration?.email || "",
        views: events.filter((item) => item.center_id === row.id && item.event_type === "view").length,
        contactClicks: events.filter((item) => item.center_id === row.id && item.event_type === "contact").length,
        lastEventAt: events.find((item) => item.center_id === row.id)?.created_at || null,
        ownerAccount: ownerMembership ? {
          id: ownerMembership.id,
          email: ownerMembership.email,
          status: ownerMembership.status,
          lastLoginAt: ownerMembership.last_active_at,
          createdAt: ownerMembership.created_at,
          authUserId: ownerMembership.user_id,
        } : legacyOwnerAccount ? {
          id: legacyOwnerAccount.id,
          email: legacyOwnerAccount.email,
          status: legacyOwnerAccount.status,
          lastLoginAt: legacyOwnerAccount.last_login_at,
          createdAt: legacyOwnerAccount.created_at,
          legacy: true,
        } : null,
      });
    }));
    const applicationItems = await Promise.all(applications.map(async (item) => ({
      id: item.id,
      centerName: item.center_name,
      ownerName: item.owner_name,
      phone: item.phone,
      email: item.email || "",
      ownerPasswordSet: Boolean(item.applicant_auth_user_id || item.owner_password_scrypt),
      therapistBackground: Boolean(item.therapist_background),
      qualificationType: item.therapist_background ? "physical_therapist" : "sports_science",
      qualificationLabel: item.therapist_background ? "물리치료사 면허" : "체육학 학위",
      area: item.area,
      address: item.address,
      naverMapUrl: item.naver_map_url,
      website: item.website,
      photoUrl: item.photo_path ? await createSignedStorageUrl(item.photo_path) : (item.photo_url || ""),
      photoUrls: await Promise.all((item.photo_paths || []).map((path) => createSignedStorageUrl(path))),
      licenseImageUrl: item.license_image_path ? await createSignedStorageUrl(item.license_image_path) : "",
      licenseHolderName: item.license_holder_name,
      licenseNumber: item.license_number,
      services: item.services,
      memo: item.memo,
      status: item.status,
      rejectionReason: item.rejection_reason,
      centerId: centerRows.find((center) => center.application_id === item.id)?.id || "",
      createdAt: item.created_at,
    })));
    await recordAuditLog(req, {
      actorUserId: admin.userId,
      actorRole: admin.role || "admin",
      action: "admin.dashboard.read",
      targetType: "dashboard",
    });
    sendJson(res, 200, {
      admin: {
        role: admin.role,
        email: admin.email || null,
      },
      totals: {
        centers: centers.length,
        pendingCenters: applications.filter((item) => item.status === "pending").length,
        partnerApplications: partnerApplications.length,
        newPartnerApplications: partnerApplications.filter((item) => item.status === "received").length,
        views: events.filter((item) => item.event_type === "view").length,
        contactClicks: events.filter((item) => item.event_type === "contact").length,
        events: events.length,
        activeOwnerAccounts: ownerMemberships.filter((item) => item.status === "active").length +
          ownerAccounts.filter((item) => item.status === "active" &&
            !ownerMemberships.some((membership) => membership.center_id === item.center_id && membership.status === "active")).length,
        pendingReviews: reviews.filter((item) => item.status === "pending").length,
      },
      centerApplications: admin.role === "analyst" ? [] : applicationItems,
      partnerApplications: admin.role === "analyst" ? [] : partnerApplications.map((item) => {
        const invitation = partnerInvitations.find((candidate) => candidate.partner_application_id === item.id);
        const invitationStatus = invitation?.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now()
          ? "expired"
          : invitation?.status;
        return ({
          id: item.id,
          applicantName: item.applicant_name,
          centerName: item.center_name || "센터명 미정",
          centerStage: item.center_stage,
          qualificationType: item.qualification_type,
          region: item.region,
          address: item.address || item.road_address || "",
          roadAddress: item.road_address || "",
          jibunAddress: item.jibun_address || "",
          lat: item.lat,
          lng: item.lng,
          naverPlaceId: item.naver_place_id || "",
          naverMapUrl: item.naver_map_url || "",
          contactEmail: item.contact_email,
          contactPhone: item.contact_phone,
          websiteUrl: item.website_url || "",
          interests: item.interests || [],
          message: item.message || "",
          status: item.status,
          adminNote: item.admin_note || "",
          source: item.source,
          lastContactedAt: item.last_contacted_at,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          registrationInvitation: invitation ? {
            id: invitation.id,
            status: invitationStatus,
            expiresAt: invitation.expires_at,
            sentAt: invitation.sent_at,
            emailStatus: invitation.email_delivery_status,
            emailError: invitation.email_error || "",
            usedAt: invitation.used_at,
            revokedAt: invitation.revoked_at,
            createdAt: invitation.created_at,
          } : null,
        });
      }),
      centers: admin.role === "analyst"
        ? centers.map(({ ownerAccount, registrationEmail, ...center }) => center)
        : centers,
      recentEvents: events.slice(0, 30).map((item) => ({
        type: item.event_type,
        centerId: item.center_id || "-",
        source: item.source,
        createdAt: item.created_at,
      })),
      reviews: admin.role === "analyst" ? [] : reviews.map((item) => ({
        id: item.id,
        centerId: item.center_id,
        userId: item.user_id,
        nickname: item.nickname,
        rating: item.rating,
        content: item.content,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    console.error("stats api failed", error);
    await recordErrorLog(req, error, {
      errorCode: "admin_stats_failed",
      statusCode: 500,
      source: "admin",
    });
    sendJson(res, 500, { error: "관리자 데이터를 불러오지 못했습니다." });
  }
};
