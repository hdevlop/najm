// ============================================================================
// Email Templates - Reusable HTML Email Templates
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS attacks
 *
 * @param text - The text to escape
 * @returns Escaped HTML-safe text
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Password reset email template
 *
 * @param params - Template parameters
 * @returns HTML email content
 */
export function passwordResetTemplate(params: {
  resetLink: string;
  userName: string;
  expiryTime?: string;
}): string {
  const { resetLink, userName, expiryTime = '1 hour' } = params;
  const safeName = escapeHtml(userName);
  const safeLink = escapeHtml(resetLink);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLink}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in ${expiryTime} for security reasons.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>For security, this link can only be used once.</p>
    </div>
    <div class="footer">
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${safeLink}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Welcome email template
 *
 * @param params - Template parameters
 * @returns HTML email content
 */
export function welcomeEmailTemplate(params: {
  userName: string;
  loginUrl?: string;
  appName?: string;
}): string {
  const { userName, loginUrl, appName = 'Our App' } = params;
  const safeName = escapeHtml(userName);
  const safeAppName = escapeHtml(appName);
  const safeLoginUrl = loginUrl ? escapeHtml(loginUrl) : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${safeAppName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${safeAppName}!</h1>
    </div>
    <div class="content">
      <p>Hello ${safeName},</p>
      <p>Thank you for joining ${safeAppName}! We're excited to have you on board.</p>
      ${safeLoginUrl ? `
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLoginUrl}" class="button">Get Started</a>
      </p>
      ` : ''}
      <p>If you have any questions, feel free to reach out to our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Account invite email template
 *
 * Sent when an admin creates an account for someone. Unlike the welcome
 * template (which links to login), this links to a one-time set-password
 * page so the invited user chooses their own credentials.
 *
 * @param params - Template parameters
 * @returns HTML email content
 */
export function accountInviteTemplate(params: {
  inviteLink: string;
  userName: string;
  appName?: string;
  accountType?: string;
  expiryTime?: string;
}): string {
  const {
    inviteLink,
    userName,
    appName = 'Your app',
    accountType,
    expiryTime = '3 days',
  } = params;
  const safeName = escapeHtml(userName);
  const safeLink = escapeHtml(inviteLink);
  const safeAppName = escapeHtml(appName);
  const safeExpiryTime = escapeHtml(expiryTime);
  const normalizedAccountType = accountType?.trim();
  const safeAccountLabel = normalizedAccountType
    ? `${escapeHtml(normalizedAccountType)} account`
    : 'account';
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Activate your ${safeAccountLabel} | ${safeAppName}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { padding: 20px 12px !important; }
      .email-card { border-radius: 18px !important; }
      .email-header, .email-content { padding-left: 24px !important; padding-right: 24px !important; }
      .email-title { font-size: 28px !important; line-height: 34px !important; }
      .email-button { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f7f4; color:#183226; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    Your ${safeAppName} ${safeAccountLabel} is ready. Confirm your email and choose your password.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#f3f7f4;">
    <tr>
      <td class="email-shell" align="center" style="padding:40px 16px;">
        <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dce8df; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(24,50,38,0.08);">
          <tr>
            <td style="height:6px; background-color:#dc7b3c; font-size:0; line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:32px 40px 30px; background-color:#173d2a; color:#ffffff;">
              <p style="margin:0 0 24px; font-size:18px; line-height:24px; font-weight:800; letter-spacing:1.8px; color:#ffffff;">${safeAppName}</p>
              <p style="margin:0 0 10px; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#f3b184;">Secure account invitation</p>
              <h1 class="email-title" style="margin:0; font-size:34px; line-height:41px; font-weight:700; letter-spacing:-0.4px; color:#ffffff;">Activate your ${safeAccountLabel}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:36px 40px 18px;">
              <p style="margin:0 0 18px; font-size:17px; line-height:27px; color:#183226;">Hello ${safeName},</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:26px; color:#40584b;">
                An administrator created a <strong style="color:#183226;">${safeAccountLabel}</strong> for you on ${safeAppName}. Confirm your email and choose a private password to activate your access.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 28px; background-color:#f4f8f5; border:1px solid #dce8df; border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 4px; font-size:14px; line-height:20px; font-weight:700; color:#173d2a;">Email confirmation + password setup</p>
                    <p style="margin:0; font-size:14px; line-height:21px; color:#5b6f63;">The secure button completes both steps with one single-use link.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
                <tr>
                  <td align="center" bgcolor="#c9652f" style="background-color:#c9652f; border-radius:12px;">
                    <a class="email-button" href="${safeLink}" target="_blank" style="display:inline-block; padding:15px 28px; border:1px solid #c9652f; border-radius:12px; color:#ffffff !important; font-size:16px; line-height:20px; font-weight:700; text-decoration:none;">
                      <span style="color:#ffffff;">Activate my ${safeAccountLabel}</span>
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 24px; border-left:4px solid #dc7b3c; background-color:#fff8f3;">
                <tr>
                  <td style="padding:14px 16px; font-size:14px; line-height:21px; color:#68422d;">
                    <strong>This invitation expires in ${safeExpiryTime}.</strong> It can be used only once. ${safeAppName} will never ask you to email this link or your password to anyone.
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:14px; line-height:22px; color:#687a70;">
                Button not working? <a href="${safeLink}" target="_blank" style="color:#315f46; font-weight:700; text-decoration:underline;">Open the secure account setup page</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;">
              <div style="height:1px; background-color:#e4ece7; font-size:0; line-height:0;">&nbsp;</div>
              <p style="margin:22px 0 6px; font-size:13px; line-height:20px; color:#718078;">If you did not expect this invitation, no action is needed.</p>
              <p style="margin:0; font-size:12px; line-height:19px; color:#8a978f;">&copy; ${currentYear} ${safeAppName}. This is an automated account-security message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Email verification template
 *
 * @param params - Template parameters
 * @returns HTML email content
 */
export function emailVerificationTemplate(params: {
  verificationLink: string;
  userName: string;
  expiryTime?: string;
}): string {
  const { verificationLink, userName, expiryTime = '24 hours' } = params;
  const safeName = escapeHtml(userName);
  const safeLink = escapeHtml(verificationLink);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email Address</h1>
    </div>
    <div class="content">
      <p>Hello ${safeName},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLink}" class="button">Verify Email</a>
      </p>
      <p>This link will expire in ${expiryTime}.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${safeLink}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
