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

const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

/** Text direction for a language tag such as `ar` or `ar-MA`. */
export function emailTextDirection(lang: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(lang.trim().toLowerCase().split('-')[0]) ? 'rtl' : 'ltr';
}

/**
 * The words of the password reset email. Every field is plain text, already
 * interpolated by the caller, and escaped here. A missing field keeps the
 * English default.
 */
export interface PasswordResetEmailCopy {
  documentTitle: string;
  heading: string;
  greeting: string;
  intro: string;
  button: string;
  expiry: string;
  ignore: string;
  singleUse: string;
  fallback: string;
}

/**
 * Password reset email template
 *
 * @param params - Template parameters; `copy` and `lang` localize it
 * @returns HTML email content
 */
export function passwordResetTemplate(params: {
  resetLink: string;
  userName: string;
  expiryTime?: string;
  lang?: string;
  copy?: Partial<PasswordResetEmailCopy>;
}): string {
  const { resetLink, userName, expiryTime = '1 hour', lang, copy = {} } = params;
  const safeLink = escapeHtml(resetLink);
  const text: PasswordResetEmailCopy = {
    documentTitle: 'Password Reset',
    heading: 'Password Reset Request',
    greeting: `Hello ${userName},`,
    intro: 'We received a request to reset your password. Click the button below to create a new password:',
    button: 'Reset Password',
    expiry: `This link will expire in ${expiryTime} for security reasons.`,
    ignore: "If you didn't request a password reset, you can safely ignore this email.",
    singleUse: 'For security, this link can only be used once.',
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    ...Object.fromEntries(Object.entries(copy).filter(([, value]) => typeof value === 'string' && value)),
  };
  const t = (key: keyof PasswordResetEmailCopy) => escapeHtml(text[key]);
  const langAttributes = lang ? ` lang="${escapeHtml(lang)}" dir="${emailTextDirection(lang)}"` : '';

  return `
<!DOCTYPE html>
<html${langAttributes}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('documentTitle')}</title>
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
      <h1>${t('heading')}</h1>
    </div>
    <div class="content">
      <p>${t('greeting')}</p>
      <p>${t('intro')}</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLink}" class="button">${t('button')}</a>
      </p>
      <p>${t('expiry')}</p>
      <p>${t('ignore')}</p>
      <p>${t('singleUse')}</p>
    </div>
    <div class="footer">
      <p>${t('fallback')}</p>
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
/**
 * The words of the account invitation email: plain text, already interpolated
 * by the caller, escaped here. A missing field keeps the English default.
 */
export interface AccountInviteEmailCopy {
  documentTitle: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  greeting: string;
  intro: string;
  stepsTitle: string;
  stepsBody: string;
  button: string;
  expiry: string;
  expiryNote: string;
  fallbackPrefix: string;
  fallbackLink: string;
  footerIgnore: string;
  footerAutomated: string;
}

/**
 * The colors and logo treatment of the account invitation email. Every field
 * is optional and a missing or unusable one keeps the default green and orange
 * look, so existing calls render as before.
 *
 * A color is a hex value, `rgb()`/`rgba()` or a color name, written into
 * inline styles; anything else is ignored rather than escaped into the markup.
 * Hex is the safest in mail clients.
 */
export interface AccountInviteEmailTheme {
  /** Page behind the card. */
  pageBackground: string;
  /** Card outline, the steps panel outline and the footer rule. */
  border: string;
  headerBackground: string;
  /** The heading in the header. */
  headerText: string;
  /** The small label above the heading. */
  eyebrow: string;
  /** The bar on top of the card and the edge of the expiry note. */
  accent: string;
  button: string;
  buttonText: string;
  /** The greeting. */
  ink: string;
  /** The introduction. */
  text: string;
  /** The "button not working" line. */
  muted: string;
  /** The fallback link. */
  link: string;
  panelBackground: string;
  panelTitle: string;
  panelText: string;
  noteBackground: string;
  noteText: string;
  /**
   * A plate behind the logo. Set it when the logo is drawn for a light
   * background, so it stays readable on a dark header. Default: no plate.
   */
  logoBackground: string;
  /** Logo height in pixels, 16 to 200. Default 52. */
  logoHeight: number;
}

const ACCOUNT_INVITE_THEME: AccountInviteEmailTheme = {
  pageBackground: '#f3f7f4',
  border: '#dce8df',
  headerBackground: '#173d2a',
  headerText: '#ffffff',
  eyebrow: '#f3b184',
  accent: '#dc7b3c',
  button: '#c9652f',
  buttonText: '#ffffff',
  ink: '#183226',
  text: '#40584b',
  muted: '#687a70',
  link: '#315f46',
  panelBackground: '#f4f8f5',
  panelTitle: '#173d2a',
  panelText: '#5b6f63',
  noteBackground: '#fff8f3',
  noteText: '#68422d',
  logoBackground: '',
  logoHeight: 52,
};

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\(\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*){2,3}\))$/i;

function resolveAccountInviteTheme(given: Partial<AccountInviteEmailTheme> = {}) {
  const colors = { ...ACCOUNT_INVITE_THEME } as Record<string, string | number>;
  for (const key of Object.keys(ACCOUNT_INVITE_THEME) as (keyof AccountInviteEmailTheme)[]) {
    if (key === 'logoHeight') continue;
    const value = given[key];
    if (typeof value === 'string' && SAFE_COLOR.test(value.trim())) colors[key] = value.trim();
  }
  const height = Number(given.logoHeight);
  const custom = Number.isFinite(height) && height > 0;
  colors.logoHeight = custom ? Math.min(200, Math.max(16, Math.round(height))) : ACCOUNT_INVITE_THEME.logoHeight;
  return {
    ...(colors as unknown as AccountInviteEmailTheme),
    // The footer rule keeps its own tint unless the caller names a border.
    divider: typeof given.border === 'string' && SAFE_COLOR.test(given.border.trim()) ? given.border.trim() : '#e4ece7',
    customLogoSize: custom,
  };
}

export function accountInviteTemplate(params: {
  inviteLink: string;
  userName: string;
  appName?: string;
  accountType?: string;
  logoSrc?: string;
  logoAlt?: string;
  expiryTime?: string;
  lang?: string;
  copy?: Partial<AccountInviteEmailCopy>;
  theme?: Partial<AccountInviteEmailTheme>;
}): string {
  const {
    inviteLink,
    userName,
    appName = 'Your app',
    accountType,
    logoSrc,
    logoAlt,
    expiryTime = '3 days',
    lang = 'en',
    copy = {},
    theme,
  } = params;
  const c = resolveAccountInviteTheme(theme);
  const safeLink = escapeHtml(inviteLink);
  const safeAppName = escapeHtml(appName);
  const safeLogoSrc = logoSrc ? escapeHtml(logoSrc) : '';
  const safeLogoAlt = escapeHtml(logoAlt?.trim() || appName);
  const normalizedAccountType = accountType?.trim();
  const safeAccountLabel = normalizedAccountType
    ? `${escapeHtml(normalizedAccountType)} account`
    : 'account';
  const currentYear = new Date().getFullYear();
  const accountLabel = normalizedAccountType ? `${normalizedAccountType} account` : 'account';
  const given = Object.fromEntries(Object.entries(copy).filter(([, value]) => typeof value === 'string' && value)) as Partial<AccountInviteEmailCopy>;
  const text: AccountInviteEmailCopy = {
    documentTitle: `Activate your ${accountLabel} | ${appName}`,
    preheader: `Your ${appName} ${accountLabel} is ready. Confirm your email and choose your password.`,
    eyebrow: 'Secure account invitation',
    heading: `Activate your ${accountLabel}`,
    greeting: `Hello ${userName},`,
    intro: '',
    stepsTitle: 'Email confirmation + password setup',
    stepsBody: 'The secure button completes both steps with one single-use link.',
    button: `Activate my ${accountLabel}`,
    expiry: `This invitation expires in ${expiryTime}.`,
    expiryNote: `It can be used only once. ${appName} will never ask you to email this link or your password to anyone.`,
    fallbackPrefix: 'Button not working?',
    fallbackLink: 'Open the secure account setup page',
    footerIgnore: 'If you did not expect this invitation, no action is needed.',
    footerAutomated: `${appName}. This is an automated account-security message.`,
    ...given,
  };
  const t = (key: keyof AccountInviteEmailCopy) => escapeHtml(text[key]);
  // The English intro emphasises the account label; a translated one is plain text.
  const intro = given.intro
    ? t('intro')
    : `An administrator created a <strong style="color:${c.ink};">${safeAccountLabel}</strong> for you on ${safeAppName}. Confirm your email and choose a private password to activate your access.`;

  const logoMaxWidth = Math.round((c.logoHeight * 132) / 52);
  const logoSize = c.customLogoSize
    ? `height="${c.logoHeight}" style="display:block; width:auto; max-width:${logoMaxWidth}px; height:${c.logoHeight}px;`
    : `width="${logoMaxWidth}" style="display:block; width:auto; max-width:${logoMaxWidth}px; height:auto; max-height:${c.logoHeight}px;`;
  const plated = Boolean(c.logoBackground);
  const logoImage = `<img src="${safeLogoSrc}" alt="${safeLogoAlt}" ${logoSize} margin:${plated ? '0' : '0 0 24px'}; border:0; outline:none; text-decoration:none; object-fit:contain;" />`;
  const logo = !safeLogoSrc
    ? `<p style="margin:0 0 24px; font-size:18px; line-height:24px; font-weight:800; letter-spacing:1.8px; color:${c.headerText};">${safeAppName}</p>`
    : plated
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;"><tr><td style="background-color:${c.logoBackground}; border-radius:18px; padding:12px 16px;">${logoImage}</td></tr></table>`
      : logoImage;

  return `
<!DOCTYPE html>
<html lang="${escapeHtml(lang)}" dir="${emailTextDirection(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${t('documentTitle')}</title>
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
<body style="margin:0; padding:0; background-color:${c.pageBackground}; color:${c.ink}; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    ${t('preheader')}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:${c.pageBackground};">
    <tr>
      <td class="email-shell" align="center" style="padding:40px 16px;">
        <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid ${c.border}; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(24,50,38,0.08);">
          <tr>
            <td style="height:6px; background-color:${c.accent}; font-size:0; line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:32px 40px 30px; background-color:${c.headerBackground}; color:${c.headerText};">
              ${logo}
              <p style="margin:0 0 10px; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:${c.eyebrow};">${t('eyebrow')}</p>
              <h1 class="email-title" style="margin:0; font-size:34px; line-height:41px; font-weight:700; letter-spacing:-0.4px; color:${c.headerText};">${t('heading')}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:36px 40px 18px;">
              <p style="margin:0 0 18px; font-size:17px; line-height:27px; color:${c.ink};">${t('greeting')}</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:26px; color:${c.text};">
                ${intro}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 28px; background-color:${c.panelBackground}; border:1px solid ${c.border}; border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 4px; font-size:14px; line-height:20px; font-weight:700; color:${c.panelTitle};">${t('stepsTitle')}</p>
                    <p style="margin:0; font-size:14px; line-height:21px; color:${c.panelText};">${t('stepsBody')}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
                <tr>
                  <td align="center" bgcolor="${c.button}" style="background-color:${c.button}; border-radius:12px;">
                    <a class="email-button" href="${safeLink}" target="_blank" style="display:inline-block; padding:15px 28px; border:1px solid ${c.button}; border-radius:12px; color:${c.buttonText} !important; font-size:16px; line-height:20px; font-weight:700; text-decoration:none;">
                      <span style="color:${c.buttonText};">${t('button')}</span>
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0 0 24px; border-left:4px solid ${c.accent}; background-color:${c.noteBackground};">
                <tr>
                  <td style="padding:14px 16px; font-size:14px; line-height:21px; color:${c.noteText};">
                    <strong>${t('expiry')}</strong> ${t('expiryNote')}
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:14px; line-height:22px; color:${c.muted};">
                ${t('fallbackPrefix')} <a href="${safeLink}" target="_blank" style="color:${c.link}; font-weight:700; text-decoration:underline;">${t('fallbackLink')}</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;">
              <div style="height:1px; background-color:${c.divider}; font-size:0; line-height:0;">&nbsp;</div>
              <p style="margin:22px 0 6px; font-size:13px; line-height:20px; color:#718078;">${t('footerIgnore')}</p>
              <p style="margin:0; font-size:12px; line-height:19px; color:#8a978f;">&copy; ${currentYear} ${t('footerAutomated')}</p>
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
