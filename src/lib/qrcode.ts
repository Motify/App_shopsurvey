import QRCode from 'qrcode'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function getSurveyUrl(qrCode: string): string {
  return `${APP_URL}/survey/${qrCode}`
}

export async function generateQRCodeDataURL(
  qrCode: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const url = getSurveyUrl(qrCode)
  return QRCode.toDataURL(url, {
    width: options?.width || 200,
    margin: options?.margin || 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

export async function generateQRCodeSVG(
  qrCode: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const url = getSurveyUrl(qrCode)
  return QRCode.toString(url, {
    type: 'svg',
    width: options?.width || 200,
    margin: options?.margin || 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

export async function generateQRCodeBuffer(
  qrCode: string,
  options?: { width?: number; margin?: number }
): Promise<Buffer> {
  const url = getSurveyUrl(qrCode)
  return QRCode.toBuffer(url, {
    width: options?.width || 400,
    margin: options?.margin || 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}
