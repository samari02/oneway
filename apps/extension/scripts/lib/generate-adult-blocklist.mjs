#!/usr/bin/env node
/**
 * Generates / refreshes:
 *   - public/adult-blocklist.json  (syncable system adult list seed)
 *   - merges NEW domains into public/rules.json (DNR)
 *   - scripts/eval/fixtures/adult-blocking-corpus.json
 *
 * Run: node apps/extension/scripts/lib/generate-adult-blocklist.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXT_ROOT = path.resolve(__dirname, '../..')
const PUBLIC = path.join(EXT_ROOT, 'public')
const RULES_PATH = path.join(PUBLIC, 'rules.json')
const BLOCKLIST_PATH = path.join(PUBLIC, 'adult-blocklist.json')
const CORPUS_PATH = path.join(EXT_ROOT, 'scripts/eval/fixtures/adult-blocking-corpus.json')
const PROMOTED_PATH = path.join(__dirname, 'promoted-adult-domains.json')
const IMPORTED_PUBLIC_PATH = path.join(__dirname, 'imported-public-adult-domains.json')

const BLOCK_REDIRECT =
  '/block-screen.html?reason=Adult%20content%20is%20blocked&type=content'

/** High-value / uncommon JP + global adult hosts to ensure coverage (additive). */
const EXPANSION_DOMAINS = [
  // Doujin / fan-market adult-only (not Fantia/ci-en/booth — policy-sensitive)
  'xcolle.jp',
  'pcolle.jp',
  'www.xcolle.jp',
  'www.pcolle.jp',
  'digiket.com',
  'www.digiket.com',
  'erodoujinshi.com',
  'doujinantena.top',
  'doujinantena.com',
  'nyahentai.re',
  'nyahentai.com',
  'wnacg.com',
  'wnacg.org',
  'comic.acgn.cc',
  'asmhentai.com',
  'hentainexus.com',
  'hentairox.com',
  'imhentai.xxx',
  'hentaiera.com',
  'hentaifox.com',
  'hbrowse.com',
  '8muses.com',
  'multporn.net',

  // FC2 ecosystem / PPV / mirrors / live
  'fc2ppv.tv',
  'fc2ppv.net',
  'fc2ppv.org',
  'fc2ppv.site',
  'fc2ppvdb.net',
  'fc2ppvdb.org',
  'adult.contents.fc2.com',
  'video.fc2.com',
  'live.fc2.com',
  'fc2live.com',
  'fc2live.jp',
  'fc2blog.us',
  'blog.fc2.com',
  'fc2id.com',
  'saymoviefc2.com',
  'fc2web.com',
  'adult.fc2.com',
  'pay.fc2.com',
  'secure.id.fc2.com',
  'video2.fc2.com',
  'content.fc2.com',
  'dic.fc2.com',
  'ranking.fc2.com',
  'fc2.com',
  'fc2ppv.com',
  'fc2ppvdb.com',

  // MissAV-style / JAV aggregators (concrete high-value hosts; regex covers many mirrors)
  'missav.com',
  'missav.ws',
  'missav.app',
  'missav.live',
  'missav.ai',
  'missav.one',
  'missavtv.com',
  'missav123.com',
  'missav123.jp',
  'missav456.com',
  'thisav.com',
  'supjav.com',
  'supjav.me',
  'jable.tv',
  'netflav.com',
  'netflav1.com',
  'hpjav.tv',
  'hpjav.com',
  'njav.tv',
  'njav.to',
  'njavtv.com',
  'javdb.com',
  'javdb365.com',
  'javbus.com',
  'javbus.org',
  'javbus.vip',
  'avgle.com',
  'avgle.net',
  '7mmtv.sx',
  '7mmtv.tv',
  'av01.tv',
  'avsox.com',
  'javlibrary.com',
  'javlibrary.net',
  'javguru.com',
  'jav.guru',
  'seejav.tv',
  'seejav.me',
  'sexjav.tv',
  'watchjavonline.com',
  'uncensoredjav.com',
  'bestjavporn.com',
  'pornjav.com',
  'r18jav.com',
  'ooojav.com',
  'jpjav.com',
  'kissjav.com',
  'kissjav.li',
  'javmost.com',
  'javmost.sx',
  'javgg.net',
  'javgg.tv',
  'javmix.tv',
  'javfull.net',
  'javfull.com',
  'javhd.com',
  'javhd.pro',
  'javhd.vip',
  'javhdporn.net',
  'javtrailers.com',
  'javwide.com',
  'javstore.net',
  'javland.net',
  'javland.to',
  'javleak.com',
  'javhihi.com',
  'javhihi.me',
  'javhive.com',
  'javhub.net',
  'javhub.me',
  'javfinder.net',
  'javfinder.me',
  'javfinder.la',
  'javfox.com',
  'javdoe.com',
  'javdoe.to',
  'javdoe.tv',
  'javcl.com',
  'javpop.com',
  'javqd.com',
  'javseen.com',
  'javseen.tv',
  'javmobile.net',
  'javmenu.com',
  'javbangers.com',
  'javble.tv',
  'jav321.com',
  'javhard.net',
  'javhard.org',
  'bejav.net',
  'vjav.com',
  '3javdaily.com',
  '91jav.com',
  '123av.com',
  '141jav.com',
  '141ppv.com',
  'avjoy.me',
  'avjoy.pro',
  'av-channel.com',
  'av-wiki.net',
  'avdanyuwiki.com',

  // Studio / uncensored JP producers
  '1pondo.tv',
  'caribbeancom.com',
  'pacopacomama.com',
  'heyzo.com',
  'mgstage.com',
  'tokyo-hot.com',
  'tokyohot.com',
  'prestige-av.com',
  'prestigeav.com',
  'madonna-av.com',
  'million-av.com',
  'kirakira-av.com',
  'bazooka-av.com',
  'sokmil.com',
  'xcity.jp',
  'erovideo.jp',
  'eroterest.net',

  // FANZA / DMM-ish
  'fanza.co.jp',
  'fanza.tv',
  'dmm.co.jp',
  'dmm.com',
  'video.dmm.co.jp',
  'adult.dmm.co.jp',
  'www.dmm.co.jp',
  'book.dmm.co.jp',
  'www.fanza.co.jp',

  // Live cams JP + global gaps
  'dxlive.com',
  'dxlive.jp',
  'chatpia.jp',
  'www.chatpia.jp',
  'gocam.jp',
  'madamlive.tv',
  'jewel-live.com',
  'milky-live.com',
  'angel-live.com',
  'angel-live.jp',
  'xliveweb.com',
  'showybeauty.com',
  'camster.com',
  'stripchat.global',
  'stripchat.com',
  'xhamsterlive.com',
  'xhamstercams.com',
  'chaturbate.com',
  'chaturbate.eu',
  'bongacams.com',
  'bongacams.net',
  'bongamodels.com',
  'cam4.com',
  'camsoda.com',
  'camsoda.net',
  'myfreecams.com',
  'myfreecams.net',
  'livejasmin.com',
  'livejasmin.net',
  'jasmin.com',
  'imlive.com',
  'islive.com',
  'islive.nl',
  'streamate.com',
  'flirt4free.com',
  'skyprivate.com',
  'cams.com',
  'camwhores.tv',
  'camwhores.video',
  'camwhoresbay.com',
  'camwhoreshd.com',
  'xlovecam.com',
  'adultwork.com',

  // Tube / mainstream adult gaps
  'pornhub.com',
  'pornhub.net',
  'pornhub.org',
  'pornhubpremium.com',
  'xvideos.com',
  'xvideos2.com',
  'xvideos3.com',
  'xvideos.es',
  'xnxx.com',
  'xnxx.tv',
  'xhamster.com',
  'xhamster2.com',
  'xhamster3.com',
  'redtube.com',
  'youporn.com',
  'youporn.net',
  'tube8.com',
  'spankbang.com',
  'eporner.com',
  'hqporner.com',
  'txxx.com',
  'sxyprn.com',
  'daftsex.com',
  'iwank.tv',
  'beeg.com',
  'tnaflix.com',
  'drtuber.com',
  'nuvid.com',
  'empflix.com',
  'anyporn.com',
  'pornhat.com',
  'porndig.com',
  'porngo.com',
  'pornone.com',
  'pornoxo.com',
  'porntrex.com',
  'porntube.com',
  'gotporn.com',
  'sunporno.com',
  'upornia.com',
  'xxxbunker.com',
  'xxxdan.com',
  'xxxfiles.com',
  'xxxymovies.com',
  'yespornplease.com',
  'yespornpleasexxx.com',
  'fullporner.com',
  'crazyporn.xxx',
  'ok.xxx',
  'analdin.xxx',
  'megatube.xxx',
  'sexvid.xxx',
  'fapster.xxx',
  'pornburst.xxx',
  'thenewporn.com',
  'zbporn.com',
  'pornhits.com',
  'pornheed.com',
  'pornhd.com',
  'pornjam.com',
  'pornky.com',
  'pornktube.com',
  'porn300.com',
  'porn555.com',
  'porn00.org',
  'pornbox.com',
  'porn.com',
  'porndoe.com',
  'pornpics.com',
  'pornrox.com',
  'hdzog.com',
  'ixxx.com',
  'vporn.com',
  'slutload.com',
  'heavy-r.com',
  'rule34.xxx',
  'erome.com',
  'eroprofile.com',
  'eroticax.com',
  'erox.plus',

  // Creator / studio nets
  'onlyfans.com',
  'fansly.com',
  'manyvids.com',
  'clips4sale.com',
  'brazzers.com',
  'bangbros.com',
  'realitykings.com',
  'mofos.com',
  'naughtyamerica.com',
  'digitalplayground.com',
  'bellesa.co',
  'adulttime.com',
  'adultempire.com',
  'adultdvdempire.com',
  'adultfilmdatabase.com',
  'adultfriendfinder.com',

  // Hentai / imageboards already common
  'nhentai.net',
  'nhentai.xxx',
  'e-hentai.org',
  'exhentai.org',
  'hitomi.la',
  'gelbooru.com',
  'rule34.paheal.net',
  'e621.net',
  'sankakucomplex.com',
  'fakku.net',
  'irodoricomics.com',
  'tsumino.com',
  'simply-hentai.com',
  'hentai2read.com',
  'hentaihaven.xxx',
  'hentaihaven.tv',
  'hentaihaven.su',
  'hentaiheroes.com',
  'hentai4.xxx',
  'doujins.com',
  'doujin-eromanga.com',
  'eromanga-cafe.com',
  'eromanga-suren.com',
  'erogazop.com',
  'erogazou-porn.com',
  'allporncomic.com',
  'porncomixonline.net',
  'cartoonpornvideos.com',
  'iwara.tv',
  'sukebei.nyaa.si',

  // More JP long-tail aggregators / mirrors
  'tokyomotion.net',
  'aventertainments.com',
  'aventertainments.net',
  'jpornaccess.com',
  '91porn.com',

  // Adult ad / affiliate networks (structural signal hosts — small curated set)
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.com',
  'trafficjunky.net',
  'popads.net',
  'ero-advertising.com',
  'tsyndicate.com',
]

/** Hostname substrings for page-analyzer / offline heuristics (keep specific). */
const HOSTNAME_SUBSTRINGS = [
  'porn', 'xxx', 'sex', 'hentai', 'adult', 'erotic', 'nude',
  'nsfw', 'fetish', 'camgirl', 'escort', 'fap', 'jav', 'xnxx',
  'fanza', 'missav', 'javdb', 'javbus', 'avgle', 'njav', 'jable',
  'netflav', 'hpjav', '7mmtv', 'xcity', 'erovideo', 'fc2ppv',
  'sokmil', 'dxlive', 'chatpia', 'sukebei', 'tokyohot', 'tokyo-hot',
  '1pondo', 'caribbeancom', 'pacopaco', 'heyzo', 'mgstage',
  'eroterest', 'xcolle', 'pcolle', 'digiket', 'nyahentai',
  'fc2live', 'camwhores', 'bongacam', 'stripchat', 'chaturbate',
  'onlyfans', 'fansly', 'spankbang', 'pornhub', 'xvideos', 'xhamster',
  'エロ', 'アダルト', '風俗', 'エロ動画', '無修正',
]

/** Policy-sensitive mixed platforms — eval / content analysis only, not hard-seed. */
const POLICY_SENSITIVE = [
  { domain: 'fantia.jp', notes: 'Mixed SFW/NSFW creator platform — prefer content analysis' },
  { domain: 'ci-en.net', notes: 'Mixed creator platform — prefer content analysis' },
  { domain: 'ci-en.jp', notes: 'Mixed creator platform — prefer content analysis' },
  { domain: 'booth.pm', notes: 'Mixed marketplace — prefer content analysis' },
  { domain: 'fanbox.cc', notes: 'Mixed creator platform — prefer content analysis' },
  { domain: 'patreon.com', notes: 'Mixed creator platform — prefer content analysis' },
]

function uniqSorted(arr) {
  return [...new Set(arr.map((d) => d.toLowerCase().trim()).filter(Boolean))].sort()
}

function loadExistingDomains(rules) {
  const domains = new Set()
  for (const r of rules) {
    for (const d of r.condition?.requestDomains || []) domains.add(d.toLowerCase())
  }
  return domains
}

function makeDnrPair(domain, mainId, subId) {
  return [
    {
      id: mainId,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { extensionPath: BLOCK_REDIRECT },
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: ['main_frame'],
      },
    },
    {
      id: subId,
      priority: 2,
      action: { type: 'block' },
      condition: {
        requestDomains: [domain],
        resourceTypes: ['sub_frame'],
      },
    },
  ]
}

function fixture(url, label, category, notes) {
  return { url, label, category, ...(notes ? { notes } : {}) }
}

function buildCorpus(allDomains, existingInRules) {
  const fixtures = []

  // --- Positives: curated category samples ---
  const positiveSamples = [
    ...[
      'https://xcolle.jp/',
      'https://www.xcolle.jp/item/123',
      'https://pcolle.jp/',
      'https://www.pcolle.jp/',
      'https://digiket.com/',
    ].map((u) => fixture(u, 'block', 'doujin_market', 'JP doujin adult marketplace')),

    ...[
      'https://fc2.com/',
      'https://video.fc2.com/',
      'https://adult.contents.fc2.com/',
      'https://fc2ppv.com/',
      'https://fc2ppv.tv/',
      'https://fc2ppvdb.com/',
      'https://live.fc2.com/',
      'https://fc2live.com/',
      'https://fc2blog.us/',
    ].map((u) => fixture(u, 'block', 'fc2_ecosystem')),

    ...[
      'https://missav.com/',
      'https://missav.ws/',
      'https://missav123.jp/',
      'https://missav123.com/',
      'https://missav456.com/',
      'https://javdb.com/',
      'https://javbus.com/',
      'https://jable.tv/',
      'https://netflav.com/',
      'https://hpjav.tv/',
      'https://njav.tv/',
      'https://avgle.com/',
      'https://supjav.com/',
      'https://7mmtv.tv/',
      'https://thisav.com/',
      'https://javlibrary.com/',
      'https://jav.guru/',
      'https://seejav.tv/',
      'https://uncensoredjav.com/',
      'https://123av.com/',
    ].map((u) => fixture(u, 'block', 'jav_aggregator')),

    ...[
      'https://fanza.co.jp/',
      'https://www.fanza.co.jp/',
      'https://dmm.co.jp/',
      'https://adult.dmm.co.jp/',
      'https://video.dmm.co.jp/',
      'https://www.dmm.co.jp/digital/videoa/',
    ].map((u) => fixture(u, 'block', 'fanza_dmm')),

    ...[
      'https://1pondo.tv/',
      'https://caribbeancom.com/',
      'https://heyzo.com/',
      'https://tokyo-hot.com/',
      'https://mgstage.com/',
      'https://pacopacomama.com/',
      'https://sokmil.com/',
      'https://xcity.jp/',
      'https://erovideo.jp/',
      'https://eroterest.net/',
    ].map((u) => fixture(u, 'block', 'jp_studio')),

    ...[
      'https://dxlive.com/',
      'https://chatpia.jp/',
      'https://gocam.jp/',
      'https://madamlive.tv/',
      'https://angel-live.jp/',
      'https://chaturbate.com/',
      'https://stripchat.com/',
      'https://stripchat.global/',
      'https://bongacams.com/',
      'https://cam4.com/',
      'https://myfreecams.com/',
      'https://livejasmin.com/',
      'https://camsoda.com/',
      'https://xhamsterlive.com/',
      'https://xliveweb.com/',
    ].map((u) => fixture(u, 'block', 'livecam')),

    ...[
      'https://pornhub.com/',
      'https://www.pornhub.com/',
      'https://xvideos.com/',
      'https://xvideos2.com/',
      'https://xnxx.com/',
      'https://xhamster.com/',
      'https://spankbang.com/',
      'https://redtube.com/',
      'https://youporn.com/',
      'https://eporner.com/',
      'https://hqporner.com/',
      'https://beeg.com/',
      'https://onlyfans.com/',
      'https://fansly.com/',
      'https://brazzers.com/',
      'https://nhentai.net/',
      'https://e-hentai.org/',
      'https://exhentai.org/',
      'https://hitomi.la/',
      'https://rule34.xxx/',
      'https://sukebei.nyaa.si/',
      'https://daftsex.com/',
      'https://iwank.tv/',
    ].map((u) => fixture(u, 'block', 'tube_global')),
  ]
  fixtures.push(...positiveSamples)

  // Extra positives from expansion list (dedupe by hostname)
  const seenHost = new Set(
    fixtures.map((f) => {
      try {
        return new URL(f.url).hostname.replace(/^www\./, '')
      } catch {
        return f.url
      }
    })
  )
  for (const d of allDomains) {
    const host = d.replace(/^www\./, '')
    if (seenHost.has(host) || seenHost.has(d)) continue
    if (fixtures.length >= 280) break
    // Prefer JP / uncommon markers for diversity
    if (!/(fc2|jav|colle|cam|live|dmm|fanza|miss|doujin|hentai|ppv|av\.|ero)/i.test(d)) {
      continue
    }
    seenHost.add(host)
    fixtures.push(fixture(`https://${d}/`, 'block', 'expansion_seed'))
  }

  // --- Hard negatives (must NOT block) ---
  const hardNegatives = [
    fixture('https://en.wikipedia.org/wiki/Human_sexuality', 'allow', 'hard_negative_wikipedia', 'Sex education encyclopedia'),
    fixture('https://en.wikipedia.org/wiki/Sexual_intercourse', 'allow', 'hard_negative_wikipedia'),
    fixture('https://en.wikipedia.org/wiki/Reproductive_health', 'allow', 'hard_negative_wikipedia'),
    fixture('https://en.wikipedia.org/wiki/Sex_education', 'allow', 'hard_negative_wikipedia'),
    fixture('https://en.wikipedia.org/wiki/Safe_sex', 'allow', 'hard_negative_wikipedia'),
    fixture('https://en.wikipedia.org/wiki/Sexually_transmitted_infection', 'allow', 'hard_negative_medical'),
    fixture('https://ja.wikipedia.org/wiki/%E6%80%A7', 'allow', 'hard_negative_wikipedia', 'JP Wikipedia sexuality'),
    fixture('https://ja.wikipedia.org/wiki/%E6%80%A7%E6%95%99%E8%82%B2', 'allow', 'hard_negative_wikipedia'),
    fixture('https://www.plannedparenthood.org/', 'allow', 'hard_negative_sex_ed'),
    fixture('https://www.plannedparenthood.org/learn/sex-pleasure', 'allow', 'hard_negative_sex_ed'),
    fixture('https://www.scarleteen.com/', 'allow', 'hard_negative_sex_ed'),
    fixture('https://www.bedsider.org/', 'allow', 'hard_negative_sex_ed', 'Birth control education — avoid hostnames containing bare "sex"'),
    fixture('https://www.cdc.gov/sexualhealth/', 'allow', 'hard_negative_medical'),
    fixture('https://www.cdc.gov/sti/', 'allow', 'hard_negative_medical'),
    fixture('https://www.nhs.uk/live-well/sexual-health/', 'allow', 'hard_negative_medical'),
    fixture('https://www.mayoclinic.org/diseases-conditions/sexually-transmitted-diseases-stds/symptoms-causes/syc-20351240', 'allow', 'hard_negative_medical'),
    fixture('https://www.webmd.com/sex/default.htm', 'allow', 'hard_negative_medical'),
    fixture('https://www.healthline.com/health/healthy-sex', 'allow', 'hard_negative_medical'),
    fixture('https://www.nih.gov/', 'allow', 'hard_negative_medical'),
    fixture('https://medlineplus.gov/sexualhealthissues.html', 'allow', 'hard_negative_medical'),
    fixture('https://www.who.int/health-topics/sexual-health', 'allow', 'hard_negative_medical'),
    fixture('https://www.metmuseum.org/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.metmuseum.org/art/collection', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.louvre.fr/en', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.moma.org/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.tate.org.uk/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.britishmuseum.org/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.nga.gov/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.rijksmuseum.nl/en', 'allow', 'hard_negative_art_museum'),
    fixture('https://artsandculture.google.com/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.victoria-albert.museum/', 'allow', 'hard_negative_art_museum'),
    fixture('https://www.victoriassecret.com/', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.victoriassecret.com/us/vs/lingerie', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.aerie.com/', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.calvinklein.us/en/women/lingerie', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.triumph.com/', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.uniqlo.com/us/en/women/innerwear', 'allow', 'hard_negative_lingerie_ecommerce'),
    fixture('https://www.amazon.com/s?k=lingerie', 'allow', 'hard_negative_lingerie_ecommerce', 'Mainstream retail search'),
    fixture('https://www.anime-news.network/', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.animenewsnetwork.com/', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.crunchyroll.com/news', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.mangasplaining.com/', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.animenewsnetwork.com/encyclopedia/manga.php?id=1', 'allow', 'hard_negative_anime_news'),
    fixture('https://myanimelist.net/', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.viz.com/', 'allow', 'hard_negative_anime_news'),
    fixture('https://www.nytimes.com/', 'allow', 'hard_negative_news'),
    fixture('https://www.bbc.com/news', 'allow', 'hard_negative_news'),
    fixture('https://www.reuters.com/', 'allow', 'hard_negative_news'),
    fixture('https://www.theguardian.com/', 'allow', 'hard_negative_news'),
    fixture('https://www.cnn.com/', 'allow', 'hard_negative_news'),
    fixture('https://www.nhk.or.jp/news/', 'allow', 'hard_negative_news'),
    fixture('https://www.asahi.com/', 'allow', 'hard_negative_news'),
    fixture('https://www.lemonde.fr/', 'allow', 'hard_negative_news'),
    fixture('https://github.com/', 'allow', 'hard_negative_dev'),
    fixture('https://github.com/torvalds/linux', 'allow', 'hard_negative_dev'),
    fixture('https://gitlab.com/', 'allow', 'hard_negative_dev'),
    fixture('https://stackoverflow.com/', 'allow', 'hard_negative_dev'),
    fixture('https://www.google.com/', 'allow', 'hard_negative_search'),
    fixture('https://www.google.com/search?q=sex+education', 'allow', 'hard_negative_search', 'Search itself not a domain block'),
    fixture('https://www.google.co.jp/', 'allow', 'hard_negative_search'),
    fixture('https://duckduckgo.com/', 'allow', 'hard_negative_search'),
    fixture('https://www.bing.com/', 'allow', 'hard_negative_search'),
    fixture('https://www.khanacademy.org/', 'allow', 'hard_negative_education'),
    fixture('https://www.britannica.com/topic/human-sexuality', 'allow', 'hard_negative_education'),
    fixture('https://www.coursera.org/', 'allow', 'hard_negative_education'),
    fixture('https://scholar.google.com/', 'allow', 'hard_negative_education'),
    fixture('https://pubmed.ncbi.nlm.nih.gov/', 'allow', 'hard_negative_medical'),
    fixture('https://www.etsy.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.apple.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.microsoft.com/', 'allow', 'hard_negative_dev'),
    fixture('https://developer.mozilla.org/', 'allow', 'hard_negative_dev'),
    fixture('https://www.reddit.com/r/AskScience/', 'allow', 'hard_negative_community', 'Not adult domain match (Focus Mode separate)'),
    fixture('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'allow', 'hard_negative_video', 'Not adult domain match'),
    fixture('https://www.twitch.tv/', 'allow', 'hard_negative_video'),
    fixture('https://www.netflix.com/', 'allow', 'hard_negative_video'),
    fixture('https://www.imdb.com/', 'allow', 'hard_negative_entertainment'),
    fixture('https://www.rottentomatoes.com/', 'allow', 'hard_negative_entertainment'),
    fixture('https://store.steampowered.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.nintendo.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.sony.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.spotify.com/', 'allow', 'hard_negative_entertainment'),
    fixture('https://open.spotify.com/', 'allow', 'hard_negative_entertainment'),
    fixture('https://www.linkedin.com/', 'allow', 'hard_negative_work'),
    fixture('https://www.notion.so/', 'allow', 'hard_negative_work'),
    fixture('https://slack.com/', 'allow', 'hard_negative_work'),
    fixture('https://www.figma.com/', 'allow', 'hard_negative_work'),
    fixture('https://mail.google.com/', 'allow', 'hard_negative_work'),
    fixture('https://outlook.live.com/', 'allow', 'hard_negative_work'),
    fixture('https://translate.google.com/', 'allow', 'hard_negative_search'),
    fixture('https://maps.google.com/', 'allow', 'hard_negative_search'),
    fixture('https://www.tripadvisor.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.booking.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.airbnb.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.ikea.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.target.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.walmart.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.nike.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.adidas.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.zara.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.hm.com/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.gap.com/', 'allow', 'hard_negative_lingerie_ecommerce', 'Fashion — not adult site'),
    fixture('https://www.japan-guide.com/', 'allow', 'hard_negative_travel'),
    fixture('https://www.jnto.go.jp/', 'allow', 'hard_negative_travel'),
    fixture('https://www.jrpass.com/', 'allow', 'hard_negative_travel'),
    fixture('https://www.tokyo-metro.jp/', 'allow', 'hard_negative_travel'),
    fixture('https://www.rakuten.co.jp/', 'allow', 'hard_negative_ecommerce'),
    fixture('https://www.yahoo.co.jp/', 'allow', 'hard_negative_search'),
    fixture('https://www.nicovideo.jp/', 'allow', 'hard_negative_video', 'Nico Nico — not adult-only'),
    fixture('https://www.pixiv.net/', 'block', 'policy_edge_dnr', 'pixiv.net is in static DNR today (aggressive adult-adjacent)'),

    // Self-improving loop / structural scenarios (domain layer + documented structural intents)
    fixture(
      'https://exoclick.com/',
      'block',
      'structural_ad_network',
      'Adult ad network host — structural signal + seed'
    ),
    fixture(
      'https://juicyads.com/',
      'block',
      'structural_ad_network',
      'Adult ad network host — structural signal + seed'
    ),
    fixture(
      'https://trafficjunky.com/',
      'block',
      'structural_ad_network',
      'Adult ad network host — structural signal + seed'
    ),
    fixture(
      'https://unknown-tube-mirror.test/',
      'allow',
      'structural_self_improve_pending',
      'Not yet in seed — would become candidate via ≥K adult outbound links in-browser; domain-only stack allows until promote'
    ),
    fixture(
      'https://www.plannedparenthood.org/',
      'allow',
      'hard_negative_structural',
      'Must never FP from structural/keyword spill'
    ),
  ]

  // Policy-sensitive: label allow for domain-only stack (content analysis may still catch NSFW pages)
  for (const p of POLICY_SENSITIVE) {
    hardNegatives.push(
      fixture(
        `https://${p.domain}/`,
        'allow',
        'policy_sensitive_allow',
        `${p.notes} — domain-only eval expects allow`
      )
    )
  }

  fixtures.push(...hardNegatives)

  // Note which positives are only in seed vs already in rules
  for (const f of fixtures) {
    if (f.label !== 'block') continue
    try {
      const host = new URL(f.url).hostname.toLowerCase()
      const bare = host.replace(/^www\./, '')
      if (!existingInRules.has(host) && !existingInRules.has(bare)) {
        f.notes = [f.notes, 'seed/heuristics/regex may cover if not yet in DNR']
          .filter(Boolean)
          .join('; ')
      }
    } catch {
      /* ignore */
    }
  }

  return fixtures
}

function main() {
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
  const existing = loadExistingDomains(rules)

  // Canonical sync list = existing DNR adult domains ∪ expansion (deduped)
  // Keep SafeSearch / non-adult out: we only union requestDomains from adult redirects (priority 2 + blockPath adult)
  const adultFromRules = []
  for (const r of rules) {
    if (r.action?.type !== 'redirect') continue
    if (!r.action?.redirect?.extensionPath?.includes('Adult')) continue
    for (const d of r.condition?.requestDomains || []) adultFromRules.push(d)
  }

  let promoted = []
  if (fs.existsSync(PROMOTED_PATH)) {
    try {
      const promoDoc = JSON.parse(fs.readFileSync(PROMOTED_PATH, 'utf8'))
      promoted = Array.isArray(promoDoc.domains)
        ? promoDoc.domains
        : Array.isArray(promoDoc)
          ? promoDoc
          : []
    } catch (e) {
      console.warn('Could not read promoted-adult-domains.json:', e.message)
    }
  }

  // Public NSFW lists complement (oisd / StevenBlack porn) — additive; empty never wipes curated seed
  let importedPublic = []
  if (fs.existsSync(IMPORTED_PUBLIC_PATH)) {
    try {
      const importedDoc = JSON.parse(fs.readFileSync(IMPORTED_PUBLIC_PATH, 'utf8'))
      importedPublic = Array.isArray(importedDoc.domains)
        ? importedDoc.domains
        : Array.isArray(importedDoc)
          ? importedDoc
          : []
    } catch (e) {
      console.warn('Could not read imported-public-adult-domains.json:', e.message)
    }
  }

  const domains = uniqSorted([
    ...adultFromRules,
    ...EXPANSION_DOMAINS,
    ...promoted,
    ...importedPublic,
  ])

  const blocklist = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: 'clarity-system',
    description:
      'System adult domain list (JP curated seed ∪ promoted ∪ public NSFW complement). Merged into static DNR at build; synced via ~/.clarity/adult-blocklist.json + GET_CONFIG (additive).',
    domains,
    sources: {
      curatedExpansion: true,
      promoted: promoted.length,
      importedPublic: importedPublic.length,
    },
    hostnameSubstrings: HOSTNAME_SUBSTRINGS,
    policySensitive: POLICY_SENSITIVE,
  }

  fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(blocklist, null, 2) + '\n')
  console.log(`Wrote ${domains.length} domains → ${path.relative(EXT_ROOT, BLOCKLIST_PATH)}`)

  // Merge missing expansion domains into rules.json
  // Reserve 12000–12999 for regex families; keep new exact-domain IDs outside that band.
  const REGEX_ID_MIN = 12000
  const REGEX_ID_MAX = 12999
  const usedIds = new Set(rules.map((r) => r.id))

  const allocId = (preferFrom) => {
    let id = preferFrom
    while (
      usedIds.has(id) ||
      (id >= REGEX_ID_MIN && id <= REGEX_ID_MAX)
    ) {
      id++
    }
    usedIds.add(id)
    return id
  }

  const redirectIds = rules
    .filter((r) => r.condition?.requestDomains && r.action?.type === 'redirect')
    .map((r) => r.id)
    .filter((id) => id < REGEX_ID_MIN)
  const blockIds = rules
    .filter((r) => r.condition?.requestDomains && r.action?.type === 'block')
    .map((r) => r.id)
    .filter((id) => id < REGEX_ID_MIN || id > REGEX_ID_MAX)

  let nextMainId = Math.max(1525, ...redirectIds, 0) + 1
  // Prefer 20000+ for block companions so we never collide with regex 12xxx
  let nextSubId = Math.max(20000, ...blockIds.filter((id) => id >= 20000), 0) + 1
  if (nextSubId <= REGEX_ID_MAX) nextSubId = REGEX_ID_MAX + 1

  const toAdd = domains.filter((d) => !existing.has(d))
  // Skip www.* if apex already present (optional); still add if neither present
  const added = []
  const newRules = []
  for (const d of toAdd) {
    const apex = d.replace(/^www\./, '')
    // Avoid duplicate www if apex being added in same pass or exists
    if (d.startsWith('www.') && (existing.has(apex) || toAdd.includes(apex))) {
      // still add www as explicit host if not covered — requestDomains on apex covers subdomains in Chrome,
      // but www.x is same registrable; skip www.* when apex is listed
      if (existing.has(apex) || domains.includes(apex)) continue
    }
    if (existing.has(d)) continue
    const mainId = allocId(nextMainId)
    nextMainId = mainId + 1
    const subId = allocId(nextSubId)
    nextSubId = subId + 1
    const pair = makeDnrPair(d, mainId, subId)
    newRules.push(...pair)
    existing.add(d)
    added.push(d)
  }

  if (newRules.length) {
    // Insert before regex rules (ids 12000+)
    const regexIdx = rules.findIndex((r) => r.id >= REGEX_ID_MIN && r.condition?.regexFilter)
    if (regexIdx >= 0) {
      rules.splice(regexIdx, 0, ...newRules)
    } else {
      rules.push(...newRules)
    }
    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n')
  }
  console.log(`Merged ${added.length} new DNR domain pairs into rules.json`)
  if (added.length) {
    console.log('  sample:', added.slice(0, 20).join(', '), added.length > 20 ? '...' : '')
  }

  // Also enrich regex family 12002 with xcolle|pcolle|digiket|fc2live if missing
  for (const r of rules) {
    if (![12002, 12003].includes(r.id)) continue
    let re = r.condition?.regexFilter
    if (typeof re !== 'string') continue
    for (const token of ['xcolle', 'pcolle', 'digiket', 'fc2live', 'nyahentai']) {
      if (!re.includes(token)) {
        re = re.replace(
          '(fanza|',
          `(fanza|${token}|`
        )
      }
    }
    r.condition.regexFilter = re
  }
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n')
  console.log('Updated DNR regex families 12002/12003 with doujin/fc2live tokens')

  const corpus = {
    version: 1,
    updatedAt: blocklist.updatedAt,
    description:
      'Offline adult-blocking eval corpus. label=block|allow. Runner scores DNR + adult-blocklist + hostname heuristics (no Chrome).',
    fixtures: buildCorpus(domains, loadExistingDomains(rules)),
  }
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2) + '\n')
  const blocks = corpus.fixtures.filter((f) => f.label === 'block').length
  const allows = corpus.fixtures.filter((f) => f.label === 'allow').length
  console.log(
    `Wrote corpus: ${corpus.fixtures.length} fixtures (${blocks} block, ${allows} allow) → ${path.relative(EXT_ROOT, CORPUS_PATH)}`
  )
}

main()
