// Region & city metadata for SMART PRICE (20 regions of Kazakhstan, current administrative division).
// Codes match ISO 3166-2:KZ used by the GeoJSON (Highcharts/OSM).

export interface RegionMeta {
  code: string;
  kk: string;
  ru: string;
  en: string;
}

export const REGIONS: RegionMeta[] = [
  { code: 'KZ-71', kk: 'Астана қаласы', ru: 'г. Астана', en: 'Astana' },
  { code: 'KZ-75', kk: 'Алматы қаласы', ru: 'г. Алматы', en: 'Almaty' },
  { code: 'KZ-79', kk: 'Шымкент қаласы', ru: 'г. Шымкент', en: 'Shymkent' },
  { code: 'KZ-19', kk: 'Алматы облысы', ru: 'Алматинская обл.', en: 'Almaty Region' },
  { code: 'KZ-11', kk: 'Ақмола облысы', ru: 'Акмолінская обл.', en: 'Akmola Region' },
  { code: 'KZ-23', kk: 'Атырау облысы', ru: 'Атырауская обл.', en: 'Atyrau Region' },
  { code: 'KZ-27', kk: 'Батыс Қазақстан облысы', ru: 'Западно-Казахстанская обл.', en: 'West Kazakhstan Region' },
  { code: 'KZ-15', kk: 'Ақтөбе облысы', ru: 'Актюбинская обл.', en: 'Aktobe Region' },
  { code: 'KZ-47', kk: 'Маңғыстау облысы', ru: 'Мангистауская обл.', en: 'Mangystau Region' },
  { code: 'KZ-63', kk: 'Шығыс Қазақстан облысы', ru: 'Восточно-Казахстанская обл.', en: 'East Kazakhstan Region' },
  { code: 'KZ-31', kk: 'Жамбыл облысы', ru: 'Жамбылская обл.', en: 'Jambyl Region' },
  { code: 'KZ-43', kk: 'Қызылорда облысы', ru: 'Кызылординская обл.', en: 'Kyzylorda Region' },
  { code: 'KZ-61', kk: 'Түркістан облысы', ru: 'Туркестанская обл.', en: 'Turkistan Region' },
  { code: 'KZ-59', kk: 'Солтүстік Қазақстан облысы', ru: 'Северо-Казахстанская обл.', en: 'North Kazakhstan Region' },
  { code: 'KZ-55', kk: 'Павлодар облысы', ru: 'Павлодарская обл.', en: 'Pavlodar Region' },
  { code: 'KZ-35', kk: 'Қарағанды облысы', ru: 'Карагандинская обл.', en: 'Karaganda Region' },
  { code: 'KZ-39', kk: 'Қостанай облысы', ru: 'Костанайская обл.', en: 'Kostanay Region' },
  { code: 'KZ-10', kk: 'Абай облысы', ru: 'Абайская обл.', en: 'Abai Region' },
  { code: 'KZ-33', kk: 'Жетісу облысы', ru: 'Жетысуская обл.', en: 'Zhetysu Region' },
  { code: 'KZ-62', kk: 'Ұлытау облысы', ru: 'Улытауская обл.', en: 'Ulytau Region' },
];

export const regionName = (code: string, lang: string): string => {
  const r = REGIONS.find(x => x.code === code);
  if (!r) return code;
  if (lang === 'kk') return r.kk;
  if (lang === 'en') return r.en;
  return r.ru;
};
