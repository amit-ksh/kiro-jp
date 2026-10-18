import { DOMParser } from "@xmldom/xmldom";
const xml = (source) =>
  new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {
        throw Error("Invalid dictionary XML");
      },
      fatalError: () => {
        throw Error("Invalid dictionary XML");
      },
    },
  }).parseFromString(source, "application/xml");
const tags = (node, name) => [...Array.from(node.getElementsByTagName(name))];
const texts = (node, name) =>
  tags(node, name).map((item) => item.textContent.trim());
const escaped = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function jmdictCandidates(source, targets) {
  const entities = Object.fromEntries(
    [...source.matchAll(/<!ENTITY\s+([\w-]+)\s+"([^"]*)">/gu)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  const wanted = new Set(targets.map((target) => target.word));
  const result = new Map(
    targets.map((target) => [`${target.word}|${target.reading}`, []]),
  );
  for (const match of source.matchAll(/<entry>[\s\S]*?<\/entry>/gu)) {
    if (
      ![...wanted].some(
        (word) =>
          match[0].includes(`<keb>${escaped(word)}</keb>`) ||
          match[0].includes(`<reb>${escaped(word)}</reb>`),
      )
    )
      continue;
    const entry = xml(
      match[0].replace(/&([\w-]+);/gu, (whole, name) =>
        entities[name] ? escaped(entities[name]) : whole,
      ),
    );
    const forms = texts(entry, "keb"),
      readings = tags(entry, "r_ele"),
      id = texts(entry, "ent_seq")[0];
    for (const target of targets) {
      if (
        !forms.includes(target.word) &&
        !(
          forms.length === 0 &&
          readings.some((reading) =>
            texts(reading, "reb").includes(target.word),
          )
        )
      )
        continue;
      const reading = readings.find((item) =>
        texts(item, "reb").includes(target.reading),
      );
      if (
        !reading ||
        (tags(reading, "re_nokanji").length && forms.length) ||
        (texts(reading, "re_restr").length &&
          !texts(reading, "re_restr").includes(target.word))
      )
        continue;
      let inheritedPos = [];
      const senses = tags(entry, "sense").flatMap((sense, index) => {
        const pos = texts(sense, "pos");
        if (pos.length) inheritedPos = pos;
        const spelling = texts(sense, "stagk"),
          restriction = texts(sense, "stagr");
        if (
          (spelling.length && !spelling.includes(target.word)) ||
          (restriction.length && !restriction.includes(target.reading))
        )
          return [];
        const glosses = tags(sense, "gloss")
          .filter(
            (gloss) =>
              !gloss.getAttribute("xml:lang") ||
              gloss.getAttribute("xml:lang") === "eng",
          )
          .map((gloss) => gloss.textContent.trim());
        return glosses.length
          ? [{ number: index + 1, glosses, pos: inheritedPos }]
          : [];
      });
      if (senses.length)
        result
          .get(`${target.word}|${target.reading}`)
          .push({ id, word: target.word, reading: target.reading, senses });
    }
  }
  return result;
}
export function kanjidicFacts(source, characters) {
  const wanted = new Set(characters),
    result = {};
  for (const match of source.matchAll(/<character>[\s\S]*?<\/character>/gu)) {
    const literal = match[0].match(/<literal>([^<]+)<\/literal>/u)?.[1];
    if (!wanted.has(literal)) continue;
    const entry = xml(match[0]);
    result[literal] = {
      meanings: tags(entry, "meaning")
        .filter((item) => !item.getAttribute("m_lang"))
        .map((item) => item.textContent.trim()),
      strokeCount: Number(texts(entry, "stroke_count")[0]),
      radical: Number(
        tags(entry, "rad_value").find(
          (item) => item.getAttribute("rad_type") === "classical",
        )?.textContent,
      ),
      on: tags(entry, "reading")
        .filter((item) => item.getAttribute("r_type") === "ja_on")
        .map((item) => item.textContent.trim()),
      kun: tags(entry, "reading")
        .filter((item) => item.getAttribute("r_type") === "ja_kun")
        .map((item) => item.textContent.trim()),
    };
  }
  for (const character of characters)
    if (!result[character]?.meanings.length)
      throw Error("Missing kanji source");
  return result;
}
export function kradFacts(source, characters) {
  const wanted = new Set(characters),
    result = {};
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^(\S) : (.+)$/u);
    if (match && wanted.has(match[1]))
      result[match[1]] = match[2].trim().split(/\s+/u);
  }
  for (const character of characters)
    if (!result[character]?.length) throw Error("Missing component source");
  return result;
}
