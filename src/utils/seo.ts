import { Designer } from '../types';

const BASE_KEYWORDS = [
  'Gentleman Barbershop',
  'Barber Myeik',
  'Market Garden Myeik',
  'မြိတ် ဆံသဆိုင်',
  'မြိတ် ဆံပင်ညှပ်',
  'GENTLEMAN Booking',
  'Myeik Barber Shop',
  'Men Haircut Myeik',
  'မြိတ် ဆံပင်ဒီဇိုင်နာ',
  'Tanintharyi Barber'
];

/**
 * Dynamically synchronizes active stylists (barbers) from Firestore into:
 * 1. Schema.org JSON-LD Structured Data ("employee" markup for direct Google Search Discovery)
 * 2. HTML <meta name="keywords"> for local search ranking by barber/stylist name in Myeik.
 */
export function syncStylistSeo(designers: Designer[]) {
  if (typeof document === 'undefined') return;

  try {
    const activeStylists = (designers || []).filter(
      (d) => d && d.id !== 'any' && d.active !== false && d.name && d.name.trim() !== ''
    );

    // 1. Update Schema.org JSON-LD structured data
    const schemaScript = document.getElementById('barbershop-schema') as HTMLScriptElement | null;
    if (schemaScript) {
      try {
        const schema = JSON.parse(schemaScript.textContent || '{}');
        if (schema && schema['@type'] === 'BarberShop') {
          if (activeStylists.length > 0) {
            schema.employee = activeStylists.map((d) => ({
              '@type': 'Person',
              name: d.name.trim(),
              jobTitle: d.title || 'Senior Barber'
            }));
          }
          schemaScript.textContent = JSON.stringify(schema, null, 2);
        }
      } catch (err) {
        console.warn('SEO Schema update warning:', err);
      }
    }

    // 2. Update <meta name="keywords"> with stylist names for local Myeik search discovery
    let metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }

    const stylistNames = activeStylists.map((d) => d.name.trim());
    const stylistKeywords: string[] = [];

    stylistNames.forEach((name) => {
      stylistKeywords.push(name);
      stylistKeywords.push(`${name} Myeik`);
      stylistKeywords.push(`${name} ဆံပင်ညှပ်`);
    });

    const combinedKeywords = Array.from(new Set([...BASE_KEYWORDS, ...stylistKeywords])).join(', ');
    metaKeywords.content = combinedKeywords;
  } catch (e) {
    console.warn('syncStylistSeo fallback:', e);
  }
}
