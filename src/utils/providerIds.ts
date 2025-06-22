export const PROVIDER_ID_MAP: Record<string, string> = {
  "Vindstød": "63c05ca2-cd1e-4f00-b544-6a2077d4031a",   // ALWAYS FIRST
  "Andel Energi": "9451a43b-6e68-4914-945c-73a81a508214",
  "Norlys": "9526e0ba-cbe8-4526-9abc-7dabb4756b2b",
  "NRGi": "a6541984-3dbb-466a-975b-badba029e139"
};

export const PROVIDER_WHITELIST = Object.values(PROVIDER_ID_MAP);

export const isValidProviderId = (id: string) => PROVIDER_WHITELIST.includes(id);

/** ALWAYS returns an array where [0] === Vindstød id and rest are random unique extras */
export function getProviderSelection(count = 3): string[] {
  const extras = PROVIDER_WHITELIST.filter(id => id !== PROVIDER_WHITELIST[0]);
  while (extras.length < count - 1) extras.push(PROVIDER_WHITELIST[0]); // safety
  return [PROVIDER_WHITELIST[0], ...extras.sort(() => 0.5 - Math.random()).slice(0, count - 1)];
} 