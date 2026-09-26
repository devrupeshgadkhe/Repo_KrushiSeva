import { GoogleGenAI, Type } from '@google/genai';
import { Request, Response } from 'express';

// Quota and Availability In-Memory Cache
interface QuotaStatusCache {
  available: boolean;
  quotaExceeded: boolean;
  reason?: string;
  checkedAt: number;
}

let quotaCache: QuotaStatusCache | null = null;
const CACHE_TTL_SUCCESS_MS = 60 * 1000; // 60 seconds cache for successful probe
const CACHE_TTL_EXCEEDED_MS = 3 * 60 * 1000; // 3 minutes cache when quota exceeded / blocked

export function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * Low-cost health and quota checker probe
 * Probes Gemini with minimal 1-token output to check if free tier or valid credits exist.
 */
export async function checkQuotaStatus(force: boolean = false): Promise<{
  available: boolean;
  quotaExceeded: boolean;
  reason?: string;
}> {
  const now = Date.now();
  if (!force && quotaCache) {
    const ttl = quotaCache.available ? CACHE_TTL_SUCCESS_MS : CACHE_TTL_EXCEEDED_MS;
    if (now - quotaCache.checkedAt < ttl) {
      return {
        available: quotaCache.available,
        quotaExceeded: quotaCache.quotaExceeded,
        reason: quotaCache.reason,
      };
    }
  }

  const ai = getGenAIClient();
  if (!ai) {
    quotaCache = {
      available: false,
      quotaExceeded: false,
      reason: 'NO_API_KEY',
      checkedAt: now,
    };
    return { available: false, quotaExceeded: false, reason: 'NO_API_KEY' };
  }

  try {
    // Probe Gemini API with minimal token output to test connectivity and quota
    await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'ping',
      config: {
        maxOutputTokens: 1,
      },
    });

    quotaCache = {
      available: true,
      quotaExceeded: false,
      checkedAt: now,
    };
    return { available: true, quotaExceeded: false };
  } catch (err: any) {
    const status = err.status || err.code || err?.response?.status;
    const msg = (err.message || '').toLowerCase();

    // Check for 403 (invalid / leaked key), 429 (quota exhausted) or resource exhaustion
    const isQuotaOrAuthError =
      status === 403 ||
      status === 429 ||
      msg.includes('quota') ||
      msg.includes('leaked') ||
      msg.includes('resource_exhausted') ||
      msg.includes('rate limit');

    quotaCache = {
      available: false,
      quotaExceeded: isQuotaOrAuthError,
      reason: isQuotaOrAuthError ? 'QUOTA_OR_AUTH_UNAVAILABLE' : 'CONNECTION_ERROR',
      checkedAt: now,
    };

    return {
      available: false,
      quotaExceeded: isQuotaOrAuthError,
      reason: quotaCache.reason,
    };
  }
}

// Strict JSON Schema for Invoice Extraction
const invoiceSchema = {
  type: Type.OBJECT,
  properties: {
    supplierName: { type: Type.STRING, description: 'Vendor, Distributor or Supplier business name' },
    supplierGstin: { type: Type.STRING, description: '15-digit GSTIN of supplier if available' },
    supplierAddress: { type: Type.STRING, description: 'Supplier full physical address' },
    supplierPhone: { type: Type.STRING, description: 'Supplier mobile or phone number' },
    supplierEmail: { type: Type.STRING, description: 'Supplier email address' },
    invoiceNumber: { type: Type.STRING, description: 'Bill / Invoice Number' },
    invoiceDate: { type: Type.STRING, description: 'Invoice date formatted as YYYY-MM-DD' },
    items: {
      type: Type.ARRAY,
      description: 'List of purchased agricultural items / products / chemicals / seeds / fertilizers',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Product brand description / name with formulation / pack' },
          hsn: { type: Type.STRING, description: 'HSN / SAC Code' },
          batchNumber: { type: Type.STRING, description: 'Batch number if printed on bill' },
          expiryDate: { type: Type.STRING, description: 'Expiry date in YYYY-MM-DD if printed on bill' },
          quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
          unit: { type: Type.STRING, description: 'Unit of measurement (e.g. PCS, NOS, BOX, KG, LTR, BAG, BTL)' },
          rate: { type: Type.NUMBER, description: 'Unit price / rate before tax' },
          discount: { type: Type.NUMBER, description: 'Item level discount amount' },
          gstRate: { type: Type.NUMBER, description: 'GST percentage rate (e.g. 0, 5, 12, 18, 28)' },
          taxableAmount: { type: Type.NUMBER, description: 'Taxable value before tax' },
          totalAmount: { type: Type.NUMBER, description: 'Line total including taxes' }
        },
        required: ['name', 'quantity', 'rate', 'gstRate', 'totalAmount']
      }
    },
    subtotal: { type: Type.NUMBER, description: 'Total taxable amount before tax' },
    taxAmount: { type: Type.NUMBER, description: 'Total GST amount' },
    grandTotal: { type: Type.NUMBER, description: 'Net payable invoice total amount' }
  },
  required: ['supplierName', 'invoiceNumber', 'items', 'grandTotal']
};

/**
 * Document Parser using Gemini Multimodal Vision
 */
export async function parseInvoiceDocument(fileBase64: string, mimeType: string) {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('AI scanner service is not configured (missing GEMINI_API_KEY).');
  }

  // Sanitize base64 (strip data URI prefix if present)
  let cleanBase64 = fileBase64;
  if (cleanBase64.includes('base64,')) {
    cleanBase64 = cleanBase64.split('base64,')[1];
  }
  cleanBase64 = cleanBase64.trim();

  // Primary model: gemini-3.1-flash-lite (fastest, high free quota), fallback: gemini-3.8-flash
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let parsedData: any = null;
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `You are an expert Indian GST tax invoice analyzer specializing in Krushi Seva Kendra / agricultural input store purchase bills, seed, pesticide, fertilizer dealer invoices.
Carefully inspect this invoice image/PDF and extract:
1. Supplier Details: Supplier Name, GSTIN (15 characters), Full Address, Phone, Email.
2. Invoice Header: Invoice / Bill Number, Invoice Date (formatted as YYYY-MM-DD). If date is in DD/MM/YYYY or DD-MM-YYYY format, convert to YYYY-MM-DD.
3. Items: For every line item on the invoice:
   - name: clear product name (include brand, chemical name, pack size if printed)
   - hsn: HSN or SAC code if present
   - batchNumber: batch or lot number if printed
   - expiryDate: expiry date formatted as YYYY-MM-DD if printed
   - quantity: numeric quantity
   - unit: unit of measurement (e.g. PCS, NOS, BOX, KG, LTR, BAG, BTL)
   - rate: unit rate / price before tax
   - discount: discount amount or 0
   - gstRate: GST percentage (0, 5, 12, 18, or 28)
   - taxableAmount: taxable value before tax
   - totalAmount: total line amount including GST
4. Totals: Subtotal (taxable), Tax Amount (total GST), Grand Total (net payable).
Ensure all numeric fields are valid numbers (not strings or nulls).
Return only the structured JSON matching the provided schema.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: invoiceSchema,
          temperature: 0.1,
        },
      });

      const text = response.text?.trim();
      if (text) {
        parsedData = JSON.parse(text);
        break; // Successfully parsed!
      }
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.code || err?.response?.status;
      const msg = (err.message || '').toLowerCase();
      
      const isQuotaOrAuthError =
        status === 403 ||
        status === 429 ||
        msg.includes('quota') ||
        msg.includes('resource_exhausted');

      if (isQuotaOrAuthError) {
        // Immediate mark quota as exhausted
        quotaCache = {
          available: false,
          quotaExceeded: true,
          reason: 'QUOTA_EXHAUSTED',
          checkedAt: Date.now(),
        };
        throw err;
      }
      console.warn(`[AI Scanner] Error with model ${model}:`, err.message);
    }
  }

  if (!parsedData) {
    throw lastError || new Error('Failed to parse invoice with Gemini Vision.');
  }

  // Post-process and sanitize fields
  if (Array.isArray(parsedData.items)) {
    parsedData.items = parsedData.items.map((it: any) => ({
      name: String(it.name || '').trim(),
      hsn: String(it.hsn || '').trim(),
      batchNumber: String(it.batchNumber || '').trim(),
      expiryDate: String(it.expiryDate || '').trim(),
      quantity: Number(it.quantity) || 1,
      unit: String(it.unit || 'PCS').trim().toUpperCase(),
      rate: Number(it.rate) || 0,
      discount: Number(it.discount) || 0,
      gstRate: Number(it.gstRate) || 0,
      taxableAmount: Number(it.taxableAmount) || (Number(it.rate) * Number(it.quantity)),
      totalAmount: Number(it.totalAmount) || (Number(it.rate) * Number(it.quantity)),
    }));
  } else {
    parsedData.items = [];
  }

  // Format date if needed
  if (parsedData.invoiceDate) {
    const raw = String(parsedData.invoiceDate).trim();
    // If format like DD/MM/YYYY
    const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      parsedData.invoiceDate = `${year}-${month}-${day}`;
    }
  } else {
    parsedData.invoiceDate = new Date().toISOString().split('T')[0];
  }

  parsedData.subtotal = Number(parsedData.subtotal) || 0;
  parsedData.taxAmount = Number(parsedData.taxAmount) || 0;
  parsedData.grandTotal = Number(parsedData.grandTotal) || 0;

  return parsedData;
}

// Express Route Handlers
export const handleQuotaStatus = async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const status = await checkQuotaStatus(force);
    res.json(status);
  } catch (err: any) {
    res.json({
      available: false,
      quotaExceeded: false,
      reason: err.message,
    });
  }
};

export const handleParseInvoice = async (req: Request, res: Response) => {
  const { fileBase64, mimeType } = req.body || {};

  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: 'File data (base64) and MIME type are required.' });
  }

  // Allowed MIME types: images and PDF
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (!allowedMime.includes(mimeType.toLowerCase())) {
    return res.status(400).json({
      error: `Unsupported file type: ${mimeType}. Please upload a JPG, PNG, WEBP image or PDF file.`,
    });
  }

  try {
    const parsedData = await parseInvoiceDocument(fileBase64, mimeType);
    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    const status = err.status || err.code || err?.response?.status;
    const msg = (err.message || '').toLowerCase();
    const isQuota =
      status === 403 ||
      status === 429 ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted');

    return res.status(isQuota ? 429 : 500).json({
      success: false,
      quotaExceeded: isQuota,
      error: isQuota
        ? 'Gemini API quota exceeded or temporarily unavailable.'
        : (err.message || 'Error parsing invoice with Gemini Vision.'),
    });
  }
};
