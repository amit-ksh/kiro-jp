#!/usr/bin/env node
const args = process.argv.slice(2);
const help =
  "node --experimental-strip-types scripts/dictionary-catalog.mjs [--check|--build --source-dir <directory>|--publish]\n--check validates the shipped starter catalog locally (default). --build reads downloaded official JMdict_e.gz, kanjidic2.xml.gz and kradfile.gz; it never downloads or publishes. --publish idempotently publishes the checked catalog to the matching development backend.\nSource files: https://www.edrdg.org/pub/Nihongo/JMdict_e.gz , https://www.edrdg.org/kanjidic/kanjidic2.xml.gz , https://www.edrdg.org/pub/Nihongo/kradfile.gz";
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log(help);
  process.exit(0);
}
if (args.length === 1 && ["--version", "-v", "-V"].includes(args[0])) {
  console.log("1.0.0");
  process.exit(0);
}
let mode = "--check",
  sourceDir;
const seen = new Set();
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (seen.has(arg)) {
    console.log("error: duplicate argument\nhelp: " + JSON.stringify(help));
    process.exit(2);
  }
  seen.add(arg);
  if (
    ["--check", "--build", "--publish"].includes(arg) &&
    [...seen].filter((item) =>
      ["--check", "--build", "--publish"].includes(item),
    ).length === 1
  )
    mode = arg;
  else if (
    arg === "--source-dir" &&
    args[i + 1] &&
    !args[i + 1].startsWith("--")
  )
    sourceDir = args[++i];
  else {
    console.log(
      "error: unknown or conflicting arguments\nhelp: " + JSON.stringify(help),
    );
    process.exit(2);
  }
}
if ((mode === "--build") !== Boolean(sourceDir)) {
  console.log(
    "error: --source-dir is required only with --build\nhelp: " +
      JSON.stringify(help),
  );
  process.exit(2);
}
let phase = "local checks";
try {
  const fs = await import("node:fs"),
    path = await import("node:path"),
    { fileURLToPath } = await import("node:url"),
    { gunzipSync } = await import("node:zlib"),
    { createHash } = await import("node:crypto");
  const root = fileURLToPath(new URL("../", import.meta.url)),
    file = path.join(root, "packages/content/src/dictionary-data.ts");
  const { preparedLessons } =
      await import("../packages/content/src/curriculum.ts"),
    { starterLevels, starterRadicals } =
      await import("../packages/content/src/levels.ts");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  if (mode === "--build") {
    phase = "source parsing";
    const { jmdictCandidates, kanjidicFacts, kradFacts } =
      await import("./lib/dictionary-source.mjs");
    const definitions = [
      {
        id: "jmdict",
        file: "JMdict_e.gz",
        url: "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz",
      },
      {
        id: "kanjidic2",
        file: "kanjidic2.xml.gz",
        url: "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
      },
      {
        id: "kradfile",
        file: "kradfile.gz",
        url: "https://www.edrdg.org/pub/Nihongo/kradfile.gz",
      },
    ];
    const bytes = definitions.map((source) =>
      fs.readFileSync(path.resolve(sourceDir, source.file)),
    );
    if (bytes.some((buffer) => buffer.length > 30_000_000))
      throw Error("source bounds");
    const decoded = bytes.map((buffer, index) =>
      new TextDecoder(index === 2 ? "euc-jp" : "utf-8", { fatal: true }).decode(
        gunzipSync(buffer, { maxOutputLength: 150_000_000 }),
      ),
    );
    const date = decoded[0].match(/JMdict created: (\d{4}-\d{2}-\d{2})/u)?.[1],
      kanjiDate = decoded[1].match(
        /<date_of_creation>([^<]+)<\/date_of_creation>/u,
      )?.[1];
    if (!date || !kanjiDate) throw Error("source dates");
    const sources = definitions.map((source, index) => ({
      id: source.id,
      url: source.url,
      licence: "CC-BY-SA-4.0",
      sha256: digest(bytes[index]),
      date: index === 1 ? kanjiDate : date,
    }));
    const selection = JSON.parse(
      fs.readFileSync(
        path.join(root, "packages/content/dictionary-selection.json"),
        "utf8",
      ),
    ).entries;
    const kanji = starterLevels.flatMap((level) => level.kanji),
      facts = kanjidicFacts(decoded[1], kanji),
      parts = kradFacts(decoded[2], kanji),
      words = jmdictCandidates(decoded[0], selection);
    const blank = {
      readings: [],
      on: [],
      kun: [],
      components: [],
      radicalNumber: 0,
      strokeCount: 0,
      sourceIds: [],
      sourceEntryIds: [],
      relatedKeys: [],
      lessonIds: [],
    };
    const entries = starterRadicals.map((radical) => ({
      ...blank,
      key: `radical:${radical.number}`,
      kind: "radical",
      characters: radical.glyph,
      meanings: [radical.name],
      radicalNumber: radical.number,
      relatedKeys: [],
      sourceIds: ["kiro-original-labels"],
      sourceEntryIds: [`kangxi:${radical.number}`],
      lessonIds: starterLevels
        .filter((level) =>
          level.radicals.some((item) => item.number === radical.number),
        )
        .map((level) => level.lessonId),
    }));
    for (const character of kanji) {
      const fact = facts[character];
      entries.push({
        ...blank,
        key: `kanji:${character}`,
        kind: "kanji",
        characters: character,
        meanings: fact.meanings,
        on: fact.on,
        kun: fact.kun,
        strokeCount: fact.strokeCount,
        radicalNumber: fact.radical,
        components: parts[character],
        sourceIds: ["kanjidic2", "kradfile"],
        sourceEntryIds: [
          `U+${character.codePointAt(0).toString(16).toUpperCase()}`,
        ],
        relatedKeys: [`radical:${fact.radical}`],
        lessonIds: preparedLessons
          .filter((lesson) =>
            lesson.words.some((word) => word.kanji.includes(character)),
          )
          .map((lesson) => lesson.id),
      });
    }
    for (const selected of selection) {
      const match = words
        .get(`${selected.word}|${selected.reading}`)
        ?.find((entry) => entry.id === selected.entryId);
      const senses = match?.senses.filter((sense) =>
        selected.senses.includes(sense.number),
      );
      if (!senses || senses.length !== selected.senses.length)
        throw Error("binding changed");
      const lessonIds = preparedLessons
        .filter((lesson) =>
          lesson.words.some(
            (word) =>
              word.word === selected.word && word.reading === selected.reading,
          ),
        )
        .map((lesson) => lesson.id);
      if (!lessonIds.length) throw Error("unused binding");
      entries.push({
        ...blank,
        key: `vocabulary:${selected.entryId}:${selected.reading}`,
        kind: "vocabulary",
        characters: selected.word,
        meanings: [...new Set(senses.flatMap((sense) => sense.glosses))],
        readings: [selected.reading],
        sourceIds: ["jmdict"],
        sourceEntryIds: selected.senses.map(
          (sense) => `${selected.entryId}#sense-${sense}`,
        ),
        relatedKeys: [
          ...new Set(
            [...selected.word]
              .filter((character) => kanji.includes(character))
              .map((character) => `kanji:${character}`),
          ),
        ],
        lessonIds,
      });
    }
    for (const entry of entries)
      for (const target of [...entry.relatedKeys]) {
        const related = entries.find((candidate) => candidate.key === target);
        if (!related) throw Error("broken relationship");
        if (!related.relatedKeys.includes(entry.key))
          related.relatedKeys.push(entry.key);
      }
    for (const entry of entries) entry.relatedKeys.sort();
    const release =
        "starter-" + digest(JSON.stringify({ sources, entries })).slice(0, 16),
      data = { release, sources, entries };
    const { assertDictionaryCatalog: validate } =
      await import("../packages/content/src/dictionary.ts");
    validate(data);
    const temporary = file + ".tmp";
    fs.writeFileSync(
      temporary,
      '// Generated by scripts/dictionary-catalog.mjs --build. EDRDG extracts: CC BY-SA 4.0. See ../NOTICE.md.\nimport type { DictionaryCatalog } from "./dictionary-types.ts";\nexport const dictionaryCatalog = ' +
        JSON.stringify(data, null, 2) +
        " satisfies DictionaryCatalog;\n",
    );
    fs.renameSync(temporary, file);
  }
  const { dictionaryCatalog } =
    await import("../packages/content/src/dictionary-data.ts");
  const { assertDictionaryCatalog } =
    await import("../packages/content/src/dictionary.ts");
  assertDictionaryCatalog(dictionaryCatalog);
  const expected =
    "starter-" +
    digest(
      JSON.stringify({
        sources: dictionaryCatalog.sources,
        entries: dictionaryCatalog.entries,
      }),
    ).slice(0, 16);
  if (expected !== dictionaryCatalog.release) throw Error("catalog changed");
  let status = mode === "--build" ? "built" : "checked";
  if (mode === "--publish") {
    phase = "development deployment configuration";
    const envFile = [".env", ".env.local", "starter-japanese/.env"]
      .map((name) => path.join(root, name))
      .find((file) => fs.existsSync(file));
    if (!envFile) throw Error("configuration");
    process.loadEnvFile(envFile);
    const key = process.env.CONVEX_DEPLOY_KEY,
      url = process.env.CONVEX_CLOUD_URL;
    if (
      !key?.startsWith("dev:") ||
      !url ||
      new URL(url).hostname !== `${key.split("|")[0].slice(4)}.convex.cloud`
    )
      throw Error("configuration");
    const { ConvexHttpClient } = await import("convex/browser"),
      client = new ConvexHttpClient(url, { logger: false });
    client.setAdminAuth(key);
    phase = "catalog publication";
    await client.mutation("dictionary:publish", {});
    status = "published";
  }
  console.log(
    `status: ${status}\nrelease: ${dictionaryCatalog.release}\nentries: ${dictionaryCatalog.entries.length}`,
  );
} catch {
  console.log(
    `error: dictionary catalog operation failed\nphase: ${phase}\nhelp: "Inspect the reviewed entry bindings and official source files, then rerun --check. No learner answers or schedules are changed."`,
  );
  process.exitCode = 1;
}
