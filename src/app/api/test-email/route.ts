import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/mailgun'

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - SysAdmin only' },
        { status: 401 }
      )
    }

    const { to } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Email address required' },
        { status: 400 }
      )
    }

    console.log('Testing email with config:', {
      domain: process.env.MAILGUN_DOMAIN,
      from: process.env.EMAIL_FROM,
      apiKeyPrefix: process.env.MAILGUN_API_KEY?.substring(0, 10) + '...',
      isEU: process.env.MAILGUN_EU === 'true',
    })

    const result = await sendEmail({
      to,
      subject: '人事CREW Test Email',
      text: 'This is a test email from 人事CREW. If you received this, your email configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>This is a test email from 人事CREW.</p>
          <p>If you received this, your email configuration is working correctly!</p>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      result,
      config: {
        domain: process.env.MAILGUN_DOMAIN,
        from: process.env.EMAIL_FROM,
        isEU: process.env.MAILGUN_EU === 'true',
      }
    })
  } catch (error) {
    console.error('Test email failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
