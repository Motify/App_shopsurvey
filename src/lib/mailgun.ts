import Mailgun from 'mailgun.js'
import FormData from 'form-data'
import type { MailgunMessageData } from 'mailgun.js'

const mailgun = new Mailgun(FormData)

// Check if EU region is needed (set MAILGUN_EU=true in .env if using EU)
const isEU = process.env.MAILGUN_EU === 'true'

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
  url: isEU ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
})

const domain = process.env.MAILGUN_DOMAIN || ''
const fromEmail = process.env.EMAIL_FROM || 'noreply@shopsurvey.com'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.warn('Mailgun not configured. Email not sent:', { to, subject })
    return { id: 'mock-id', message: 'Email skipped (Mailgun not configured)' }
  }

  try {
    const messageData = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
    } as MailgunMessageData

    const result = await mg.messages.create(domain, messageData)
    return result
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

export async function sendAdminInvite(
  email: string,
  name: string,
  companyName: string,
  inviteToken: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const setupUrl = `${appUrl}/setup-password?token=${inviteToken}`

  const subject = `You've been invited to ${companyName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background-color: #000; border-radius: 50%; line-height: 48px; color: #fff; font-size: 24px; font-weight: bold;">S</div>
          </div>
          <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">You've been invited!</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">Hello ${name},</p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">You've been invited to join <strong>${companyName}</strong> on ShopSurvey, our employee engagement survey platform.</p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">Click the button below to set up your password and get started:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${setupUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">Set Up Your Account</a>
          </div>
          <p style="color: #888; font-size: 14px; line-height: 20px; margin: 32px 0 0 0;">This link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #888; font-size: 12px; margin: 0;">ShopSurvey - Employee Engagement Survey System</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `You've been invited to ${companyName}

Hello ${name},

You've been invited to join ${companyName} on ShopSurvey, our employee engagement survey platform.

Click the link below to set up your password and get started:
${setupUrl}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
ShopSurvey - Employee Engagement Survey System`

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl}/setup-password?token=${resetToken}&reset=true`

  const subject = 'Reset your ShopSurvey password'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background-color: #000; border-radius: 50%; line-height: 48px; color: #fff; font-size: 24px; font-weight: bold;">S</div>
          </div>
          <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">Reset Your Password</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">Hello ${name},</p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">We received a request to reset your password for your ShopSurvey account.</p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">Reset Password</a>
          </div>
          <p style="color: #888; font-size: 14px; line-height: 20px; margin: 32px 0 0 0;">This link will expire in 7 days. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #888; font-size: 12px; margin: 0;">ShopSurvey - Employee Engagement Survey System</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `Reset Your Password

Hello ${name},

We received a request to reset your password for your ShopSurvey account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 7 days.

If you didn't request a password reset, you can safely ignore this email.

---
ShopSurvey - Employee Engagement Survey System`

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  })
}

export async function sendSurveyInvite(
  email: string,
  shopName: string,
  surveyUrl: string
) {
  const subject = `Employee Survey from ${shopName}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Your Opinion Matters!</h1>
      <p>Hello,</p>
      <p>You've been invited to participate in an employee survey for <strong>${shopName}</strong>.</p>
      <p>Your feedback is valuable and will help us create a better workplace.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${surveyUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Take the Survey
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">The survey takes approximately 5 minutes to complete.</p>
      <p style="color: #666; font-size: 14px;">Your responses are anonymous.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px;">ShopSurvey - Employee Retention Survey System</p>
    </div>
  `

  const text = `
Your Opinion Matters!

Hello,

You've been invited to participate in an employee survey for ${shopName}.

Your feedback is valuable and will help us create a better workplace.

Take the survey here:
${surveyUrl}

The survey takes approximately 5 minutes to complete.
Your responses are anonymous.

---
ShopSurvey - Employee Retention Survey System
  `

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  })
}
