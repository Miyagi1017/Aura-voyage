export interface ThemePalette {
  id: string;
  name: string;
  subtitle: string;
  swatches: string[]; // 5 hex colors displayed in selector preview
  bgApp: string;
  bgSurface: string;
  bgSurfaceSubtle: string;
  border: string;
  borderActive: string;
  textHeading: string;
  textBody: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  accent: string;
  accentGlow: string;
  badgeBg: string;
  badgeText: string;
  mapTileClass: string;
  routeColor: string;
  routeGlow: string;
  markerBg: string;
  markerText: string;
}

export const LIGHT_THEMES: Record<string, ThemePalette> = {
  regal_twilight_light: {
    id: 'regal_twilight_light',
    name: 'Regal Twilight Clair',
    subtitle: 'Albâtre, Grès sablé & Or antique',
    swatches: ['#F7F5F0', '#E0DCD1', '#CCC0AD', '#A08B62', '#4D4865'],
    bgApp: '#F8F6F1',
    bgSurface: '#FFFFFF',
    bgSurfaceSubtle: '#F2EFEB',
    border: '#E3DDD3',
    borderActive: '#A08B62',
    textHeading: '#242246',
    textBody: '#4D4865',
    textMuted: '#7E7A91',
    primary: '#A08B62',
    primaryHover: '#8C774E',
    primaryText: '#FFFFFF',
    accent: '#B5985A',
    accentGlow: 'rgba(160, 139, 98, 0.25)',
    badgeBg: 'rgba(160, 139, 98, 0.12)',
    badgeText: '#7B673E',
    mapTileClass: 'aura-map-regal-light',
    routeColor: '#A08B62',
    routeGlow: '#CDB683',
    markerBg: 'linear-gradient(135deg, #A08B62, #CDB683)',
    markerText: '#FFFFFF',
  },
  riviera_azur: {
    id: 'riviera_azur',
    name: 'Riviera Céleste',
    subtitle: 'Azur Méditerranée, Écume & Ambre',
    swatches: ['#F4F8FA', '#E2EDF4', '#0284C7', '#0F766E', '#D97706'],
    bgApp: '#F4F8FB',
    bgSurface: '#FFFFFF',
    bgSurfaceSubtle: '#EBF3F8',
    border: '#D3E3EE',
    borderActive: '#0284C7',
    textHeading: '#0F172A',
    textBody: '#334155',
    textMuted: '#64748B',
    primary: '#0284C7',
    primaryHover: '#0369A1',
    primaryText: '#FFFFFF',
    accent: '#0F766E',
    accentGlow: 'rgba(2, 132, 199, 0.25)',
    badgeBg: 'rgba(2, 132, 199, 0.12)',
    badgeText: '#0369A1',
    mapTileClass: 'aura-map-riviera-light',
    routeColor: '#0284C7',
    routeGlow: '#38BDF8',
    markerBg: 'linear-gradient(135deg, #0284C7, #0EA5E9)',
    markerText: '#FFFFFF',
  },
  toscane_terracotta: {
    id: 'toscane_terracotta',
    name: 'Toscane & Sienne',
    subtitle: 'Terre cuite, Lin brut & Vert cyprès',
    swatches: ['#FAF5F0', '#EFE6DC', '#C25E38', '#E68A5C', '#3F5B46'],
    bgApp: '#FAF6F2',
    bgSurface: '#FFFFFF',
    bgSurfaceSubtle: '#F3ECE4',
    border: '#E8DCD1',
    borderActive: '#C25E38',
    textHeading: '#281B13',
    textBody: '#5A463B',
    textMuted: '#847165',
    primary: '#C25E38',
    primaryHover: '#A84C28',
    primaryText: '#FFFFFF',
    accent: '#3F5B46',
    accentGlow: 'rgba(194, 94, 56, 0.25)',
    badgeBg: 'rgba(194, 94, 56, 0.12)',
    badgeText: '#A84C28',
    mapTileClass: 'aura-map-toscane-light',
    routeColor: '#C25E38',
    routeGlow: '#E68A5C',
    markerBg: 'linear-gradient(135deg, #C25E38, #E68A5C)',
    markerText: '#FFFFFF',
  },
  kyoto_washi: {
    id: 'kyoto_washi',
    name: 'Kyoto Minimaliste',
    subtitle: 'Papier Washi, Thé Matcha & Encre Sumi',
    swatches: ['#F9F9F6', '#EDECE6', '#4E6B56', '#728E7A', '#9B5068'],
    bgApp: '#F8F8F5',
    bgSurface: '#FFFFFF',
    bgSurfaceSubtle: '#EFEFEA',
    border: '#E1E0D7',
    borderActive: '#4E6B56',
    textHeading: '#1A211D',
    textBody: '#455048',
    textMuted: '#737F76',
    primary: '#4E6B56',
    primaryHover: '#3C5443',
    primaryText: '#FFFFFF',
    accent: '#9B5068',
    accentGlow: 'rgba(78, 107, 86, 0.25)',
    badgeBg: 'rgba(78, 107, 86, 0.12)',
    badgeText: '#3C5443',
    mapTileClass: 'aura-map-kyoto-light',
    routeColor: '#4E6B56',
    routeGlow: '#728E7A',
    markerBg: 'linear-gradient(135deg, #4E6B56, #728E7A)',
    markerText: '#FFFFFF',
  },
  sahara_dore: {
    id: 'sahara_dore',
    name: 'Dunes du Sahara',
    subtitle: 'Sable chaud, Safran & Indigo nomade',
    swatches: ['#FBF7EE', '#F3EAD5', '#C68B35', '#E0A94E', '#1D4E6B'],
    bgApp: '#FBF8F0',
    bgSurface: '#FFFFFF',
    bgSurfaceSubtle: '#F3ECD9',
    border: '#E7DCB9',
    borderActive: '#C68B35',
    textHeading: '#2B1C0B',
    textBody: '#5B472C',
    textMuted: '#89755B',
    primary: '#C68B35',
    primaryHover: '#AE7627',
    primaryText: '#FFFFFF',
    accent: '#1D4E6B',
    accentGlow: 'rgba(198, 139, 53, 0.25)',
    badgeBg: 'rgba(198, 139, 53, 0.12)',
    badgeText: '#A26D20',
    mapTileClass: 'aura-map-sahara-light',
    routeColor: '#C68B35',
    routeGlow: '#E0A94E',
    markerBg: 'linear-gradient(135deg, #C68B35, #E0A94E)',
    markerText: '#FFFFFF',
  },
};
