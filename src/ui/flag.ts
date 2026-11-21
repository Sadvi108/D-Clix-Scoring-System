// Country flag (emoji) for a 3-letter IOC/WT country code, e.g. 'KOR' → 🇰🇷. Unknown codes (clubs) → ''.
const IOC_TO_ISO: Record<string, string> = {
  AFG: 'AF', ALG: 'DZ', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ', BAN: 'BD', BEL: 'BE', BLR: 'BY',
  BRA: 'BR', BRN: 'BH', BRU: 'BN', BUL: 'BG', CAM: 'KH', CAN: 'CA', CHI: 'CL', CHN: 'CN', CIV: 'CI', COL: 'CO',
  CRC: 'CR', CRO: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DEN: 'DK', DOM: 'DO', ECU: 'EC', EGY: 'EG', ESA: 'SV',
  ESP: 'ES', EST: 'EE', FIJ: 'FJ', FIN: 'FI', FRA: 'FR', GBR: 'GB', GEO: 'GE', GER: 'DE', GHA: 'GH', GRE: 'GR',
  GUA: 'GT', HKG: 'HK', HUN: 'HU', INA: 'ID', IND: 'IN', IRI: 'IR', IRL: 'IE', IRQ: 'IQ', ISL: 'IS', ISR: 'IL',
  ITA: 'IT', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KOR: 'KR', KSA: 'SA', KUW: 'KW', LAO: 'LA',
  LAT: 'LV', LBN: 'LB', LTU: 'LT', LUX: 'LU', MAC: 'MO', MAR: 'MA', MAS: 'MY', MDA: 'MD', MEX: 'MX', MGL: 'MN',
  MKD: 'MK', MLT: 'MT', MNE: 'ME', MON: 'MC', MYA: 'MM', NED: 'NL', NEP: 'NP', NGR: 'NG', NOR: 'NO', NZL: 'NZ',
  OMA: 'OM', PAK: 'PK', PAN: 'PA', PAR: 'PY', PER: 'PE', PHI: 'PH', PLE: 'PS', POL: 'PL', POR: 'PT', PRK: 'KP',
  PUR: 'PR', QAT: 'QA', ROU: 'RO', RSA: 'ZA', RUS: 'RU', SGP: 'SG', SLO: 'SI', SRB: 'RS', SRI: 'LK', SUI: 'CH',
  SVK: 'SK', SWE: 'SE', SYR: 'SY', THA: 'TH', TJK: 'TJ', TKM: 'TM', TPE: 'TW', TUN: 'TN', TUR: 'TR', UAE: 'AE',
  UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ', VEN: 'VE', VIE: 'VN', YEM: 'YE', ZIM: 'ZW',
};

export function flag(nat: string | undefined): string {
  const iso = nat ? IOC_TO_ISO[nat.toUpperCase()] : undefined;
  if (!iso) return '';
  return String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
