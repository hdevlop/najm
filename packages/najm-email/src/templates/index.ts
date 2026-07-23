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
  expiryTime?: string;
}): string {
  const { inviteLink, userName, appName = 'Our App', expiryTime = '3 days' } = params;
  const safeName = escapeHtml(userName);
  const safeLink = escapeHtml(inviteLink);
  const safeAppName = escapeHtml(appName);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set up your account</title>
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
      <h1>Welcome to ${safeAppName}</h1>
    </div>
    <div class="content">
      <p>Hello ${safeName},</p>
      <p>An account has been created for you on ${safeAppName}. Click the button below to set your password and finish setting up your account:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLink}" class="button">Set Your Password</a>
      </p>
      <p>This link will expire in ${expiryTime} for security reasons.</p>
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
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