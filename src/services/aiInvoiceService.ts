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

class AiInvoiceService {
  private lastQuotaStatus: QuotaStatusResponse = {
    available: false,
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
   * Check if Gemini API quota is available
   */
  async checkQuotaStatus(force: boolean = false): Promise<QuotaStatusResponse> {
    const now = Date.now();
    // Cache on client for 45s unless forced
    if (!force && now - this.lastCheckedTime < 45 * 1000 && this.lastCheckedTime > 0) {
      return this.lastQuotaStatus;
    }

    try {
      const res = await fetch(`/api/ai/quota-status${force ? '?force=true' : ''}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        this.lastQuotaStatus = {
          available: false,
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
        available: false,
        quotaExceeded: false,
        reason: 'NETWORK_ERROR',
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
   * Send document image/PDF base64 to server endpoint for Gemini parsing
   */
  async parseInvoice(fileBase64: string, mimeType: string): Promise<ParseInvoiceResponse> {
    try {
      const res = await fetch('/api/ai/parse-invoice', {
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
          error: json.error || 'Gemini API quota exceeded.',
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
