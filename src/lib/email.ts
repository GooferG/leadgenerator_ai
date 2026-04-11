import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!
const APP_URL = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export async function sendNewUserNotification({
  name,
  email,
}: {
  name: string | null
  email: string
}) {
  const displayName = name ?? email

  try {
    await resend.emails.send({
      from: 'Lead Generator <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `New user waiting for approval — ${displayName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
          <h2 style="margin-bottom: 4px;">New sign-up</h2>
          <p style="color: #555; margin-top: 0;">Someone just signed up and is waiting for approval.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 80px;">Name</td>
              <td style="padding: 8px 0; font-weight: 500;">${displayName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${email}</td>
            </tr>
          </table>

          <a
            href="${APP_URL}/admin"
            style="display: inline-block; background: #10b981; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px;"
          >
            Review in Admin Panel →
          </a>
        </div>
      `,
    })
  } catch (err) {
    // Non-fatal — log but don't block the sign-in flow
    console.error('Failed to send new user notification:', err)
  }
}
