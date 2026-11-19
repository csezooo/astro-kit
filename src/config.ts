/**
 * A platform közös értékei az Astro-oldalakhoz.
 * Ha valami változik (pl. a platform címe), itt kell átírni,
 * és a csomag frissítése után minden oldal megkapja.
 */
// Az Astro / Vite env változói (import.meta.env) – így a kit önmagában, az Astro típusai nélkül is hibátlan
declare global {
  interface ImportMetaEnv {
    readonly PUBLIC_WM_API_URL?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const WM = {
  /** A platform API címe. Felülírható oldalanként: PUBLIC_WM_API_URL env változó */
  apiUrl: import.meta.env?.PUBLIC_WM_API_URL ?? 'https://app.weboldaltmost.hu',
  brand: {
    name: 'WeboldaltMost',
    url: 'https://weboldaltmost.hu/',
    creditText: 'Építette és karbantartja:',
    color: '#F5C400',
  },
} as const;

export type FieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date'
  | 'select' | 'radio' | 'checkboxes' | 'checkbox' | 'heading';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string | null;
  /** Súgószöveg a mező alatt (a 'heading'-nél a magyarázó szöveg) */
  help?: string | null;
  width?: 'half' | 'full';
  options?: string[];
}

export interface FormSchema {
  id: string;
  /** Ujjlenyomat: ha a panelen módosítják az űrlapot, megváltozik (ld. ContactForm élő frissítés) */
  version?: string;
  name: string;
  endpoint: string;
  fields: FormField[];
  submit_label: string;
  success_message: string;
  honeypot_field: string;
  timestamp_field: string;
  turnstile_site_key: string | null;
  texts: { sending: string; error: string; validation: string };
}

/** Az űrlap mezőit build közben lekéri a platformról */
export async function fetchFormSchema(formId: string, apiUrl: string = WM.apiUrl): Promise<FormSchema | null> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/forms/${formId}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as FormSchema;
  } catch {
    return null;
  }
}
