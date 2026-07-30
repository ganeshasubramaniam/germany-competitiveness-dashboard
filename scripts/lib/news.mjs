import { fetchText } from "./http.mjs";

const TOPICS = [
  {
    id: "macro",
    label: "Macro & demand",
    keywords: ["bruttoinlandsprodukt", "wirtschaftswachstum", "konjunktur", "produktion", "auftragseingang", "inflation", "insolvenz"],
    mechanism: "It changes the evidence on demand, output or business resilience.",
  },
  {
    id: "energy",
    label: "Energy & infrastructure",
    keywords: ["strom", "energie", "gas", "netz", "netzausbau", "kraftwerk", "erneuerbar", "wasserstoff", "gigawatt", "breitband"],
    mechanism: "Energy and infrastructure costs affect industrial location, margins and investment.",
  },
  {
    id: "innovation",
    label: "Innovation & digital",
    keywords: ["forschung", "innovation", "künstliche intelligenz", "ki ", "halbleiter", "chip", "digital", "cloud", "startup"],
    mechanism: "Innovation diffusion determines whether research becomes scalable productivity.",
  },
  {
    id: "industry",
    label: "Industry & investment",
    keywords: ["industrie", "investition", "werk", "fabrik", "standort", "kapazität", "auftrag", "automobil", "maschinenbau", "chemie"],
    mechanism: "Capacity, orders and investment change Germany's future industrial base.",
  },
  {
    id: "trade",
    label: "Trade & resilience",
    keywords: ["export", "import", "handel", "zoll", "lieferkette", "china", "usa", "rohstoff", "wirtschaftssicherheit"],
    mechanism: "Trade access and concentrated dependencies shape the resilience of export industries.",
  },
  {
    id: "labour",
    label: "Labour & skills",
    keywords: ["arbeitsmarkt", "beschäftigung", "arbeitslos", "fachkräfte", "ausbildung", "arbeitsplätze", "stellenabbau", "kurzarbeit"],
    mechanism: "Labour supply and skills constrain potential output and project delivery.",
  },
  {
    id: "policy",
    label: "Regulation & competition",
    keywords: ["gesetz", "regulierung", "genehmigung", "wettbewerb", "kartell", "beihilfe", "subvention", "steuer", "bürokratie"],
    mechanism: "Binding policy can change the cost, speed and certainty of doing business.",
  },
  {
    id: "finance",
    label: "Finance & capital",
    keywords: ["kredit", "zins", "finanzierung", "bank", "kapitalmarkt", "direktinvestition", "haushalt", "sondervermögen"],
    mechanism: "Financing conditions determine whether viable projects become productive assets.",
  },
];

const EVENT_WORDS = [
  "beschließt", "beschlossen", "genehmigt", "investiert", "baut", "eröffnet", "schließt",
  "streicht", "stellenabbau", "übernimmt", "fusion", "auftrag", "fördert", "finanziert",
];
const POSITIVE_WORDS = ["investiert", "eröffnet", "ausbau", "genehmigt", "auftrag", "wachstum", "steigt", "fördert"];
const NEGATIVE_WORDS = ["schließt", "streicht", "stellenabbau", "sinkt", "rückgang", "insolvenz", "zoll", "kurzarbeit"];
const LOW_SIGNAL_WORDS = ["meinung", "interview", "veranstaltung", "rede", "konsultation", "anhörung"];

function decodeXml(value = "") {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function atomLink(block) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return decodeXml(match?.[1] ?? "");
}

export function parseFeed(xml, source) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return blocks
    .map((match) => {
      const block = match[2];
      const title = tag(block, "title");
      const url = tag(block, "link") || atomLink(block);
      const published =
        tag(block, "pubDate") ||
        tag(block, "dc:date") ||
        tag(block, "date") ||
        tag(block, "published") ||
        tag(block, "updated");
      const publishedAt = new Date(published);
      if (!title || !url || Number.isNaN(publishedAt.valueOf())) return null;
      return {
        id: tag(block, "guid") || tag(block, "id") || url,
        title,
        url,
        publishedAt: publishedAt.toISOString(),
        source: source.name,
        sourceId: source.id,
        kind: source.kind,
        authority: source.authority,
      };
    })
    .filter(Boolean);
}

function normalizeTitle(title) {
  return title
    .toLocaleLowerCase("de")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(der|die|das|ein|eine|und|oder|mit|für|von|im|in|zu|zur|zum|am|an|202\d)\b/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["ref", "source"].includes(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function scoreItem(item) {
  const text = item.title.toLocaleLowerCase("de");
  const topics = TOPICS.filter((topic) => topic.keywords.some((keyword) => text.includes(keyword)));
  let score = item.authority;
  const rules = [`authority +${item.authority}`];
  if (topics.length) {
    score += 2;
    rules.push("priority topic +2");
  }
  if (EVENT_WORDS.some((word) => text.includes(word))) {
    score += 3;
    rules.push("binding or company event +3");
  }
  if (/(\d+(?:[.,]\d+)?)\s*(milliarden|millionen|mrd\.?|mio\.?|gw|arbeitsplätze|jobs|%)/i.test(text)) {
    score += 2;
    rules.push("quantified magnitude +2");
  }
  if (LOW_SIGNAL_WORDS.some((word) => text.includes(word))) {
    score -= 2;
    rules.push("low-action format −2");
  }
  const positive = POSITIVE_WORDS.some((word) => text.includes(word));
  const negative = NEGATIVE_WORDS.some((word) => text.includes(word));
  const polarity = positive === negative ? "mixed" : positive ? "positive" : "negative";
  const primaryTopic = topics[0] ?? null;
  return {
    ...item,
    url: canonicalUrl(item.url),
    score: Math.max(0, Math.min(10, score)),
    topics: topics.map((topic) => topic.label),
    polarity,
    rules,
    whyItMatters: primaryTopic
      ? `${primaryTopic.mechanism} This is a ${polarity} signal under the headline rule, not a forecast.`
      : "The item comes from an authoritative German source, but its competitiveness channel is not yet specific.",
  };
}

export function curateNews(items, now = new Date()) {
  const cutoff = now.valueOf() - 14 * 24 * 60 * 60 * 1000;
  const seen = new Set();
  return items
    .filter((item) => new Date(item.publishedAt).valueOf() >= cutoff)
    .map(scoreItem)
    .filter((item) => item.score >= 6 && item.topics.length)
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
    .filter((item) => {
      const key = `${item.url}|${normalizeTitle(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export async function fetchNewsSource(source) {
  const xml = await fetchText(source.url);
  const items = parseFeed(xml, source);
  if (!items.length) throw new Error(`${source.name} returned no valid feed items`);
  return items;
}
