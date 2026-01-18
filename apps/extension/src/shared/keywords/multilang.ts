/**
 * Multi-language Keywords — Layer 2 Search Intelligence
 * 
 * Explicit terms in various languages to catch international searches.
 * Users often try to bypass filters by searching in other languages.
 */

/** Japanese explicit terms */
export const JAPANESE_KEYWORDS = [
  // Katakana
  'エロ',        // ero
  'アダルト',    // adult
  'セックス',    // sex
  'ヌード',      // nude
  'ポルノ',      // porno
  'エッチ',      // ecchi (lewd)
  'フェラ',      // fellatio
  'オナニー',    // masturbation
  
  // Hiragana (same words, different script - users try both!)
  'えろ',        // ero (hiragana)
  'せっくす',    // sex (hiragana)
  'えっち',      // ecchi (hiragana)
  'おなにー',    // masturbation (hiragana)
  
  // Kanji
  '無修正',      // uncensored
  'おっぱい',    // oppai (breasts)
  '裸',          // naked
  'AV',          // adult video (common abbreviation)
  '痴女',        // slut
  '熟女',        // mature woman
  '素人',        // amateur
  '中出し',      // creampie
  '巨乳',        // big breasts
  '美乳',        // beautiful breasts
  '潮吹き',      // squirting
  '乱交',        // orgy
  
  // Romaji (romanized Japanese)
  'ero', 'ecchi', 'hentai', 'oppai', 'paizuri',
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
 * Normalize repeated characters in any script (including CJK)
 * えろろろ → えろ, порнооо → порно
 */
function normalizeRepeatedChars(text: string): string {
  // Remove any character repeated 2+ times in a row
  return text.replace(/(.)\1+/g, '$1')
}

/**
 * Check if query contains multilingual explicit keywords
 * Also handles repeated character evasion (えろろろ → えろ)
 */
export function checkMultilangKeywords(query: string): {
  found: boolean
  score: number
  matchedTerms: string[]
} {
  const normalizedQuery = query.toLowerCase()
  // Also check with repeated chars removed for evasion detection
  const deduplicatedQuery = normalizeRepeatedChars(normalizedQuery)
  
  const matchedTerms: string[] = []
  let evasionDetected = false
  
  for (const keyword of ALL_MULTILANG_KEYWORDS) {
    const keywordLower = keyword.toLowerCase()
    
    // Check original query
    if (normalizedQuery.includes(keywordLower)) {
      matchedTerms.push(keyword)
    }
    // Check deduplicated query (catches えろろろ → えろ)
    else if (deduplicatedQuery.includes(keywordLower)) {
      matchedTerms.push(keyword + ' (evasion)')
      evasionDetected = true
    }
  }
  
  // Higher score if evasion was attempted
  const baseScore = matchedTerms.length > 0 ? 50 : 0
  const evasionBonus = evasionDetected ? 15 : 0
  
  return {
    found: matchedTerms.length > 0,
    score: baseScore + evasionBonus,
    matchedTerms
  }
}
