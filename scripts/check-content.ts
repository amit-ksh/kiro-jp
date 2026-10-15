import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
if (args.length === 1 && ["--version", "-v", "-V"].includes(args[0]!)) {
  console.log("1.1.0");
  process.exit(0);
}
if (args.includes("--help")) {
  console.log(
    "description: Validate every released lesson and its immutable audio package.\nflags: --help, --version\nexample: pnpm check:content",
  );
  process.exit(0);
}
if (args.length) {
  console.log(
    "error: unknown arguments\nhelp: use pnpm check:content without arguments, or --help",
  );
  process.exit(2);
}
try {
  const { preparedLessons } =
    await import("../packages/content/src/curriculum.ts");
  const { checkedContentManifests } =
    await import("../packages/content/src/content-manifests.ts");
  const { buildContentPackage } = await import("./lib/content-package.mjs");
  const root = fileURLToPath(new URL("../", import.meta.url));
  if (
    !preparedLessons.length ||
    checkedContentManifests.length !== preparedLessons.length
  )
    throw Error("inventory");
  const rows = [];
  for (const lesson of preparedLessons) {
    const { manifest } = buildContentPackage(root, lesson);
    const expected = checkedContentManifests.find(
      (m) => m.lessonId === lesson.id && m.version === lesson.version,
    );
    if (!expected || JSON.stringify(manifest) !== JSON.stringify(expected))
      throw Error("package");
    rows.push({
      id: lesson.id,
      version: lesson.version,
      exercises: lesson.exercises.length,
      assets: manifest.assets.length,
    });
  }
  console.log(
    "status: checked\ncount: " +
      rows.length +
      "\nlessons[" +
      rows.length +
      "]{id,version,exercises,assets}:\n" +
      rows
        .map(
          (row) =>
            "  " + [row.id, row.version, row.exercises, row.assets].join(","),
        )
        .join("\n"),
  );
} catch {
  console.log(
    "error: content source or package gate failed\nhelp: Check reviewed text, audio records and versioned manifests before publishing. Audio/playback and live conversation checks remain separate.",
  );
  process.exitCode = 1;
}
