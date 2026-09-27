export interface ScannedInvoiceItem {
  name: string;
  hsn?: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  gstRate: number;
  taxableAmount: number;
  totalAmount: number;
}

export interface ScannedInvoiceData {
  supplierName: string;
  supplierGstin?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ScannedInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
}

export interface QuotaStatusResponse {
  available: boolean;
  quotaExceeded: boolean;
  reason?: string;
}

export interface ParseInvoiceResponse {
  success: boolean;
  data?: ScannedInvoiceData;
  error?: string;
  quotaExceeded?: boolean;
}

const REMOTE_SERVER_URL = 'https://ais-pre-edysvf2kzw65acv534pahe-256649770211.asia-southeast1.run.app';

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    return path;
  }
  return `${REMOTE_SERVER_URL}${path}`;
}

class AiInvoiceService {
  private lastQuotaStatus: QuotaStatusResponse = {
    available: true,
    quotaExceeded: false,
  };
  private lastCheckedTime = 0;
  private listeners: ((status: QuotaStatusResponse) => void)[] = [];

  subscribe(listener: (status: QuotaStatusResponse) => void) {
    this.listeners.push(listener);
    listener(this.lastQuotaStatus);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.lastQuotaStatus));
  }

  /**
   * Check if scanner quota is available (Works in both Browser and Electron Desktop)
   */
  async checkQuotaStatus(force: boolean = false): Promise<QuotaStatusResponse> {
    const now = Date.now();
    // Cache on client for 45s unless forced
    if (!force && now - this.lastCheckedTime < 45 * 1000 && this.lastCheckedTime > 0) {
      return this.lastQuotaStatus;
    }

    // 1. Priority: If running inside Electron desktop app with IPC bridge
    if (typeof window !== 'undefined' && (window as any).electronAPI?.aiCheckQuota) {
      try {
        const desktopRes = await (window as any).electronAPI.aiCheckQuota();
        if (desktopRes && typeof desktopRes.available === 'boolean') {
          this.lastQuotaStatus = {
            available: desktopRes.available,
            quotaExceeded: Boolean(desktopRes.quotaExceeded),
            reason: desktopRes.reason,
          };
          this.lastCheckedTime = Date.now();
          this.notify();
          return this.lastQuotaStatus;
        }
      } catch (ipcErr) {
        console.warn('[DesktopApp] IPC checkQuota notice:', ipcErr);
      }
    }

    // 2. Browser preview or fallback fetch
    try {
      const url = `${getApiUrl('/api/ai/quota-status')}${force ? '?force=true' : ''}`;
      const res = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        this.lastQuotaStatus = {
          available: res.status !== 429 && res.status !== 403,
          quotaExceeded: res.status === 429 || res.status === 403,
          reason: `HTTP_${res.status}`,
        };
      } else {
        const data = await res.json();
        this.lastQuotaStatus = {
          available: Boolean(data.available),
          quotaExceeded: Boolean(data.quotaExceeded),
          reason: data.reason,
        };
      }
    } catch {
      this.lastQuotaStatus = {
        available: true,
        quotaExceeded: false,
        reason: 'OFFLINE_READY',
      };
    }

    this.lastCheckedTime = Date.now();
    this.notify();
    return this.lastQuotaStatus;
  }

  /**
   * Mark quota as exhausted (e.g. when 429 received from parse call)
   */
  markQuotaExhausted() {
    this.lastQuotaStatus = {
      available: false,
      quotaExceeded: true,
      reason: 'QUOTA_EXHAUSTED',
    };
    this.lastCheckedTime = Date.now();
    this.notify();
  }

  /**
   * Send document image/PDF base64 to server endpoint for parsing
   */
  async parseInvoice(fileBase64: string, mimeType: string): Promise<ParseInvoiceResponse> {
    // 1. Priority: If running inside Electron desktop app with IPC bridge
    if (typeof window !== 'undefined' && (window as any).electronAPI?.aiParseInvoice) {
      try {
        const desktopRes = await (window as any).electronAPI.aiParseInvoice({ fileBase64, mimeType });
        if (desktopRes) {
          if (desktopRes.quotaExceeded) {
            this.markQuotaExhausted();
          }
          return desktopRes;
        }
      } catch (ipcErr) {
        console.warn('[DesktopApp] IPC parseInvoice notice:', ipcErr);
      }
    }

    // 2. Browser preview or fallback fetch
    try {
      const url = getApiUrl('/api/ai/parse-invoice');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileBase64, mimeType }),
      });

      const json = await res.json();

      if (res.status === 429 || json.quotaExceeded) {
        this.markQuotaExhausted();
        return {
          success: false,
          quotaExceeded: true,
          error: json.error || 'दैनिक मर्यादा संपली आहे.',
        };
      }

      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json.error || 'Failed to parse invoice.',
        };
      }

      return {
        success: true,
        data: json.data,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error while contacting AI scanner service.',
      };
    }
  }
}

export const aiInvoiceService = new AiInvoiceService();
