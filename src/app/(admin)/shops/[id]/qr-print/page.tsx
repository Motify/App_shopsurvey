'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface Shop {
  id: string
  name: string
  qrCode: string
}

export default function QRPrintPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const [shop, setShop] = useState<Shop | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  useEffect(() => {
    fetchShop()
  }, [id])

  useEffect(() => {
    if (shop?.qrCode) {
      generateQRCode(shop.qrCode)
    }
  }, [shop?.qrCode])

  useEffect(() => {
    // Auto-trigger print dialog when QR code is ready
    if (qrCodeDataUrl && shop) {
      const timer = setTimeout(() => {
        window.print()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [qrCodeDataUrl, shop])

  const fetchShop = async () => {
    try {
      const response = await fetch(`/api/shops/${id}`)
      if (!response.ok) {
        throw new Error('Shop not found')
      }
      const data = await response.json()
      setShop(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (qrCode: string) => {
    try {
      const QRCode = (await import('qrcode')).default
      const surveyUrl = `${appUrl}/survey/${qrCode}`
      const dataUrl = await QRCode.toDataURL(surveyUrl, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setQrCodeDataUrl(dataUrl)
    } catch (err) {
      console.error('Failed to generate QR code:', err)
    }
  }

  const getSurveyUrl = () => {
    if (!shop) return ''
    return `${appUrl}/survey/${shop.qrCode}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error || 'Shop not found'}</p>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-8 text-gray-900">
            {shop.name}
          </h1>

          {qrCodeDataUrl ? (
            <div className="flex justify-center mb-8">
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                className="w-[300px] h-[300px]"
              />
            </div>
          ) : (
            <div className="flex justify-center items-center w-[300px] h-[300px] mx-auto mb-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          <p className="text-lg text-gray-700 mb-4 font-mono break-all">
            {getSurveyUrl()}
          </p>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <p className="text-xl text-gray-800 font-medium">
              スマートフォンでスキャンしてアンケートに回答してください
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Scan with your smartphone to take the survey
            </p>
          </div>

          <div className="mt-8 print:hidden">
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Print
            </button>
            <button
              onClick={() => window.close()}
              className="ml-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
