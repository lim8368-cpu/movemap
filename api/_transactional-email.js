function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function transactionalEmailConfigured() {
  return Boolean(clean(process.env.RESEND_API_KEY, 2_000) && clean(process.env.TRANSACTIONAL_EMAIL_FROM, 320));
}

async function sendTransactionalEmail({ to, subject, html, text }) {
  if (!transactionalEmailConfigured()) {
    return { sent: false, status: "not_configured", error: null };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clean(process.env.RESEND_API_KEY, 2_000)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: clean(process.env.TRANSACTIONAL_EMAIL_FROM, 320),
      to: [clean(to, 254)],
      subject: clean(subject, 200),
      html: String(html || ""),
      text: String(text || ""),
      ...(clean(process.env.TRANSACTIONAL_EMAIL_REPLY_TO, 254)
        ? { reply_to: clean(process.env.TRANSACTIONAL_EMAIL_REPLY_TO, 254) }
        : {}),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(clean(result.message || result.error || `Email provider returned ${response.status}`, 500));
  }
  return { sent: true, status: "sent", id: clean(result.id, 200), error: null };
}

async function sendPartnerRegistrationInvitation({ to, applicantName, centerName, inviteUrl, expiresAt }) {
  const safeApplicant = escapeHtml(applicantName || "센터 담당자");
  const safeCenter = escapeHtml(centerName || "신청 센터");
  const safeUrl = escapeHtml(inviteUrl);
  const expiresLabel = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(expiresAt));
  const safeExpires = escapeHtml(expiresLabel);

  return sendTransactionalEmail({
    to,
    subject: `[DAIL] ${centerName || "파트너 센터"} 정식 등록 안내`,
    text: [
      `${applicantName || "센터 담당자"}님, 안녕하세요.`,
      `${centerName || "신청 센터"}의 파트너 검토가 완료되어 정식 센터 등록 링크를 보내드립니다.`,
      `등록 링크: ${inviteUrl}`,
      `유효기간: ${expiresLabel}까지`,
      "이 링크는 한 번만 사용할 수 있으며, 본인이 요청하지 않았다면 DAIL 운영팀에 알려주세요.",
    ].join("\n\n"),
    html: `<!doctype html><html lang="ko"><body style="margin:0;background:#f4f6f7;font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#17283d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dfe5e8;border-radius:18px;overflow:hidden"><tr><td style="padding:30px 32px 14px"><div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:#087e79">DAIL PARTNER</div><h1 style="margin:14px 0 12px;font-size:27px;line-height:1.3">정식 센터 등록을 시작해 주세요</h1><p style="margin:0;color:#566270;font-size:15px;line-height:1.75">${safeApplicant}님, ${safeCenter}의 파트너 검토가 완료되었습니다. 아래 버튼에서 센터 정보와 전문 자격 서류를 등록해 주세요.</p></td></tr><tr><td style="padding:18px 32px"><a href="${safeUrl}" style="display:block;padding:15px 20px;border-radius:10px;background:#17283d;color:#fff;text-decoration:none;text-align:center;font-weight:800">정식 센터 등록하기</a><p style="margin:12px 0 0;text-align:center;color:#7b8692;font-size:12px">${safeExpires}까지 유효 · 1회 사용</p></td></tr><tr><td style="padding:8px 32px 30px"><div style="padding:16px;border-radius:10px;background:#f4f7f7;color:#65717d;font-size:12px;line-height:1.7">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br><span style="word-break:break-all;color:#17283d">${safeUrl}</span></div></td></tr></table></td></tr></table></body></html>`,
  });
}

module.exports = {
  sendPartnerRegistrationInvitation,
  sendTransactionalEmail,
  transactionalEmailConfigured,
};
