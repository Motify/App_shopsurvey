'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Shop {
  id: string
  name: string
  qrCode: string
}

function BulkPrintContent() {
  const searchParams = useSearchParams()
  const [shops, setShops] = useState<Shop[]>([])
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const ids = searchParams.get('ids')?.split(',') || []

  useEffect(() => {
    if (ids.length > 0) {
      fetchShops()
    }
  }, [])

  useEffect(() => {
    if (shops.length > 0) {
      generateAllQRCodes()
    }
  }, [shops])

  useEffect(() => {
    // Auto-trigger print dialog when all QR codes are ready
    if (qrCodes.size === shops.length && shops.length > 0) {
      const timer = setTimeout(() => {
        window.print()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [qrCodes.size, shops.length])

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops')
      if (response.ok) {
        const allShops = await response.json()
        const selectedShops = allShops.filter((s: Shop) => ids.includes(s.id))
        setShops(selectedShops)
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateAllQRCodes = async () => {
    const QRCode = (await import('qrcode')).default
    const newQrCodes = new Map<string, string>()

    for (const shop of shops) {
      try {
        const surveyUrl = `${appUrl}/survey/${shop.qrCode}`
        const dataUrl = await QRCode.toDataURL(surveyUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
        newQrCodes.set(shop.id, dataUrl)
      } catch (err) {
        console.error(`Failed to generate QR code for ${shop.name}:`, err)
      }
    }

    setQrCodes(newQrCodes)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (shops.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No shops selected</p>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-break {
            page-break-after: always;
          }
          .page-break:last-child {
            page-break-after: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
        >
          Print All ({shops.length})
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Close
        </button>
      </div>

      <div className="bg-white">
        {shops.map((shop, index) => (
          <div
            key={shop.id}
            className={`min-h-screen flex items-center justify-center p-8 ${
              index < shops.length - 1 ? 'page-break' : ''
            }`}
          >
            <div className="text-center max-w-md">
              <h1 className="text-3xl font-bold mb-8 text-gray-900">
                {shop.name}
              </h1>

              {qrCodes.get(shop.id) ? (
                <div className="flex justify-center mb-8">
                  <img
                    src={qrCodes.get(shop.id)}
                    alt={`QR Code for ${shop.name}`}
                    className="w-[300px] h-[300px]"
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center w-[300px] h-[300px] mx-auto mb-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}

              <p className="text-lg text-gray-700 mb-4 font-mono break-all">
                {appUrl}/survey/{shop.qrCode}
              </p>

              <div className="border-t border-gray-200 pt-6 mt-6">
                <p className="text-xl text-gray-800 font-medium">
                  スマートフォンでスキャンしてアンケートに回答してください
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Scan with your smartphone to take the survey
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function BulkPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <BulkPrintContent />
    </Suspense>
  )
}
