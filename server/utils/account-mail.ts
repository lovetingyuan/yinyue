export function hasAccountMail(config: ReturnType<typeof useRuntimeConfig>) {
  return Boolean(config.resendApiKey && config.mailFrom) || localPreview(config);
}

function localPreview(config: ReturnType<typeof useRuntimeConfig>) {
  return (
    config.mailPreview && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(config.public.siteUrl)
  );
}

export async function sendAccountMail(to: string, subject: string, url: string) {
  const config = useRuntimeConfig();
  if (!config.resendApiKey || !config.mailFrom) {
    if (localPreview(config)) {
      console.info(`[本地邮件预览] ${subject} ${url}`);
      return;
    }
    throw createError({ statusCode: 503, statusMessage: "Account email is not configured" });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: config.mailFrom, to: [to], subject, text: `${subject}\n${url}` }),
  });
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: "Account email delivery failed" });
  }
}
