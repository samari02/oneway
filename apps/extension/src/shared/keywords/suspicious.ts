/**
 * Suspicious Combinations — Layer 2 Search Intelligence
 * 
 * These words are INNOCENT alone but become SUSPICIOUS when combined.
 * Example: "girl" = OK, "video" = OK, "girl video hot" = SUSPICIOUS
 * 
 * This catches searches like:
 * - "sauna xxx"
 * - "girl ero" 
 * - "hot teen video"
 * - "massage asian video"
 */

/** Modifiers - adjectives that become suspicious with other terms */
export const SUSPICIOUS_MODIFIERS = [
  // Physical descriptors
  'hot', 'sexy', 'beautiful', 'gorgeous', 'stunning',
  'young', 'teen', 'mature', 'old',
  'asian', 'latina', 'ebony', 'blonde', 'brunette', 'redhead',
  'amateur', 'homemade', 'real',
  'big', 'small', 'huge', 'tiny',
  
  // Relationship/role
  'step', 'stepmom', 'stepdad', 'stepsis', 'stepbro',
  'teacher', 'student', 'boss', 'secretary',
  'neighbor', 'roommate', 'babysitter',
  'doctor', 'nurse', 'massage',
  
  // Settings
  'shower', 'bath', 'pool', 'beach', 'sauna',
  'bedroom', 'hotel', 'office',
  'public', 'outdoor', 'car',
] as const

/** Subjects - who/what the search is about */
export const SUSPICIOUS_SUBJECTS = [
  'girl', 'girls', 'woman', 'women', 'female',
  'guy', 'guys', 'man', 'men', 'male',
  'model', 'models',
  'actress', 'actor', 'celebrity', 'celeb',
  'wife', 'husband', 'girlfriend', 'boyfriend',
  'mom', 'mommy', 'dad', 'daddy',
  'sister', 'brother',
  'friend', 'couple', 'couples',
] as const

/** Suffixes - what type of content */
export const SUSPICIOUS_SUFFIXES = [
  // Media types
  'video', 'videos', 'vid', 'vids',
  'pic', 'pics', 'photo', 'photos', 'image', 'images',
  'gif', 'gifs', 'clip', 'clips',
  'movie', 'movies', 'film', 'films',
  
  // States
  'nude', 'nudes', 'naked',
  'topless', 'undressing', 'stripping',
  
  // Foreign terms often used
  'ero', 'ecchi',
  'xxx', 'xx',
  
  // Actions
  'leaked', 'leak',
  'caught', 'hidden', 'spy',
  'free', 'download',
] as const

/** Context words that make combinations safe */
export const SAFE_CONTEXT_WORDS = [
  // Medical/Health
  'cancer', 'medical', 'health', 'doctor', 'hospital',
  'disease', 'treatment', 'symptoms', 'diagnosis',
  'pregnancy', 'pregnant', 'birth', 'baby',
  
  // Academic/Educational
  'research', 'study', 'academic', 'university', 'school',
  'education', 'educational', 'learn', 'course',
  'wikipedia', 'definition', 'meaning',
  'history', 'historical', 'science', 'scientific',
  
  // News/Documentary
  'news', 'article', 'documentary', 'report', 'journalism',
  'interview', 'investigation',
  
  // Art/Culture
  'art', 'artistic', 'museum', 'gallery', 'painting',
  'sculpture', 'photography', 'photographer',
  'fashion', 'runway', 'model agency',
  
  // Sports/Fitness
  'fitness', 'workout', 'exercise', 'gym',
  'yoga', 'swimming', 'athlete',
  
  // Professional
  'acting', 'audition', 'casting call',
  'career', 'job', 'professional',
] as const

/** Quick lookup sets */
export const MODIFIERS_SET = new Set(SUSPICIOUS_MODIFIERS.map(s => s.toLowerCase()))
export const SUBJECTS_SET = new Set(SUSPICIOUS_SUBJECTS.map(s => s.toLowerCase()))
export const SUFFIXES_SET = new Set(SUSPICIOUS_SUFFIXES.map(s => s.toLowerCase()))
export const SAFE_CONTEXT_SET = new Set(SAFE_CONTEXT_WORDS.map(s => s.toLowerCase()))

/**
 * Analyze a query for suspicious combinations
 */
export function analyzeSuspiciousCombinations(normalizedQuery: string): {
  isSuspicious: boolean
  score: number
  matchedCombination: string | null
  hasSafeContext: boolean
} {
  const words = normalizedQuery.toLowerCase().split(/\s+/)
  const wordSet = new Set(words)
  
  // Check for safe context first
  const hasSafeContext = words.some(word => SAFE_CONTEXT_SET.has(word))
  if (hasSafeContext) {
    return {
      isSuspicious: false,
      score: 0,
      matchedCombination: null,
      hasSafeContext: true
    }
  }
  
  // Find matches in each category
  const foundModifiers = words.filter(w => MODIFIERS_SET.has(w))
  const foundSubjects = words.filter(w => SUBJECTS_SET.has(w))
  const foundSuffixes = words.filter(w => SUFFIXES_SET.has(w))
  
  // Calculate suspicion based on combinations
  let score = 0
  let matchedCombination: string | null = null
  
  // Modifier + Subject + Suffix = Very suspicious (score: 40)
  if (foundModifiers.length > 0 && foundSubjects.length > 0 && foundSuffixes.length > 0) {
    score = 40
    matchedCombination = `${foundModifiers[0]} + ${foundSubjects[0]} + ${foundSuffixes[0]}`
  }
  // Modifier + Suffix = Suspicious (score: 30)
  else if (foundModifiers.length > 0 && foundSuffixes.length > 0) {
    score = 30
    matchedCombination = `${foundModifiers[0]} + ${foundSuffixes[0]}`
  }
  // Subject + Suffix = Suspicious (score: 25)
  else if (foundSubjects.length > 0 && foundSuffixes.length > 0) {
    score = 25
    matchedCombination = `${foundSubjects[0]} + ${foundSuffixes[0]}`
  }
  // Multiple modifiers = Mildly suspicious (score: 15)
  else if (foundModifiers.length >= 2) {
    score = 15
    matchedCombination = `${foundModifiers[0]} + ${foundModifiers[1]}`
  }
  
  return {
    isSuspicious: score > 0,
    score,
    matchedCombination,
    hasSafeContext: false
  }
}
