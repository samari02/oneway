/**
 * Multi-language Keywords — Layer 2 Search Intelligence
 * 
 * Explicit terms in various languages to catch international searches.
 * Users often try to bypass filters by searching in other languages.
 */

/** Japanese explicit terms */
export const JAPANESE_KEYWORDS = [
  // Kanji/Hiragana
  'エロ',        // ero
  'アダルト',    // adult
  '無修正',      // uncensored
  'セックス',    // sex
  'おっぱい',    // oppai (breasts)
  'ヌード',      // nude
  '裸',          // naked
  'ポルノ',      // porno
  'AV',          // adult video (common abbreviation)
  'エッチ',      // ecchi (lewd)
  '痴女',        // slut
  '熟女',        // mature woman
  '素人',        // amateur
  'フェラ',      // fellatio
  '中出し',      // creampie
  
  // Romaji (romanized Japanese)
  'ero', 'ecchi', 'hentai', 'oppai',
] as const

/** Chinese explicit terms (Simplified + Traditional) */
export const CHINESE_KEYWORDS = [
  // Simplified
  '色情',        // pornography
  '成人',        // adult
  '裸体',        // naked
  '性爱',        // sex/lovemaking
  '做爱',        // have sex
  '自慰',        // masturbation
  '口交',        // oral sex
  '乳房',        // breasts
  '阴茎',        // penis
  '阴道',        // vagina
  
  // Traditional
  '裸體',        // naked
  '性愛',        // sex
  
  // Pinyin (romanized)
  'seqing', 'luoti',
] as const

/** Spanish explicit terms */
export const SPANISH_KEYWORDS = [
  'porno', 'pornografía', 'pornografia',
  'sexo', 'sexual',
  'desnuda', 'desnudo', 'desnudas', 'desnudos',
  'puta', 'putas', 'perra',
  'tetas', 'culo', 'coño',
  'follando', 'follar', 'coger',
  'chupando', 'mamada',
  'corrida', 'orgasmo',
  'caliente', // hot (in sexual context)
  'cachonda', 'cachondo', // horny
] as const

/** German explicit terms */
export const GERMAN_KEYWORDS = [
  'porno', 'pornografie',
  'nackt', 'nackte', 'nackten',
  'sex', 'ficken', 'gefickt',
  'titten', 'brüste',
  'arsch', 'muschi', 'schwanz',
  'geil', 'geile', // horny
  'hure', 'schlampe', // slut
  'blasen', 'blowjob',
  'wichsen', // jerk off
] as const

/** Portuguese explicit terms */
export const PORTUGUESE_KEYWORDS = [
  'porno', 'pornô', 'pornografia',
  'sexo', 'sexual',
  'nua', 'nuas', 'nu', 'nus', 'pelada', 'pelado',
  'puta', 'vadia', 'piranha',
  'buceta', 'xoxota', 'pau', 'rola',
  'foda', 'fodendo', 'trepando',
  'gostosa', 'gostoso', // hot/sexy
  'safada', 'safado', // naughty
  'punheta', // masturbation
  'boquete', // blowjob
] as const

/** French explicit terms */
export const FRENCH_KEYWORDS = [
  'porno', 'pornographie',
  'sexe', 'sexuel', 'sexuelle',
  'nue', 'nu', 'nues', 'nus',
  'salope', 'pute', 'putain',
  'beurette', // North African woman (fetishized term)
  'nichons', 'seins', // breasts
  'cul', 'fesses', // ass
  'chatte', 'bite', 'queue', // genitals
  'baiser', 'niquer', 'foutre', // fuck
  'branler', 'branlette', // masturbation
  'sucer', 'pipe', // oral
] as const

/** Russian explicit terms (Cyrillic) */
export const RUSSIAN_KEYWORDS = [
  'порно', 'порнография',
  'секс', 'сексуальный',
  'голая', 'голый', 'голые',
  'сиськи', 'грудь',
  'жопа', 'попа',
  'пизда', 'хуй', 'член',
  'ебать', 'трахать',
  'шлюха', 'блядь',
  'дрочить', // masturbate
] as const

/** Italian explicit terms */
export const ITALIAN_KEYWORDS = [
  'porno', 'pornografia',
  'sesso', 'sessuale',
  'nuda', 'nudo', 'nude', 'nudi',
  'tette', 'culo', 'figa', 'cazzo',
  'scopare', 'scopata',
  'troia', 'puttana', 'zoccola',
  'pompino', 'sega',
] as const

/** Arabic explicit terms */
export const ARABIC_KEYWORDS = [
  'سكس',         // sex
  'بورن',        // porn
  'عاري',        // naked
  'نيك',         // fuck
  'كس',          // vagina
  'زب',          // penis
  'شرموطة',      // slut
] as const

/** Dutch explicit terms */
export const DUTCH_KEYWORDS = [
  'porno', 'pornografie',
  'seks', 'seksueel',
  'naakt', 'naakte', 'bloot',
  'tieten', 'kont', 'kutje', 'pik', 'lul',
  'neuken', 'geneukt',
  'hoer', 'slet',
  'pijpen', 'aftrekken',
] as const

/** Korean explicit terms */
export const KOREAN_KEYWORDS = [
  '포르노',      // porno
  '야동',        // adult video
  '섹스',        // sex
  '누드',        // nude
  '벗은',        // naked
  '자위',        // masturbation
  'ㅇㅎ',        // abbreviation for 야한 (lewd)
  '19금',        // 19+ rated
] as const

/** All multilingual keywords combined */
export const ALL_MULTILANG_KEYWORDS = [
  ...JAPANESE_KEYWORDS,
  ...CHINESE_KEYWORDS,
  ...SPANISH_KEYWORDS,
  ...GERMAN_KEYWORDS,
  ...PORTUGUESE_KEYWORDS,
  ...FRENCH_KEYWORDS,
  ...RUSSIAN_KEYWORDS,
  ...ITALIAN_KEYWORDS,
  ...ARABIC_KEYWORDS,
  ...DUTCH_KEYWORDS,
  ...KOREAN_KEYWORDS,
] as const

/** Quick lookup set */
export const MULTILANG_KEYWORDS_SET = new Set(
  ALL_MULTILANG_KEYWORDS.map(k => k.toLowerCase())
)

/**
 * Check if query contains multilingual explicit keywords
 */
export function checkMultilangKeywords(query: string): {
  found: boolean
  score: number
  matchedTerms: string[]
} {
  const normalizedQuery = query.toLowerCase()
  const matchedTerms: string[] = []
  
  for (const keyword of ALL_MULTILANG_KEYWORDS) {
    if (normalizedQuery.includes(keyword.toLowerCase())) {
      matchedTerms.push(keyword)
    }
  }
  
  return {
    found: matchedTerms.length > 0,
    score: matchedTerms.length > 0 ? 50 : 0, // High score for foreign explicit terms
    matchedTerms
  }
}
