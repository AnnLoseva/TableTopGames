import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type AuditRow = {
  discipline: string;
  path: string;
  level: string;
  power: string;
  pool: "yes" | "no";
  cost: "yes" | "no";
  effect: "yes" | "no";
  duration: "yes" | "no";
  mechanics: "yes" | "no";
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasField = (power: JsonObject, field: string): "yes" | "no" =>
  Object.prototype.hasOwnProperty.call(power, field) ? "yes" : "no";

function getPowerContainer(value: JsonObject): unknown {
  if (isObject(value.powers)) return value.powers;
  const levelEntries = Object.entries(value).filter(([key]) =>
    Number.isFinite(Number(key))
  );
  return levelEntries.length > 0
    ? Object.fromEntries(levelEntries)
    : undefined;
}

function collectPowers(
  rows: AuditRow[],
  discipline: string,
  path: string,
  powers: unknown,
): void {
  if (powers === undefined) {
    return;
  }

  if (!isObject(powers)) {
    throw new Error(
      `Expected powers for "${discipline}"${path ? ` / "${path}"` : ""} to be an object.`,
    );
  }

  for (const [level, levelPowers] of Object.entries(powers)) {
    if (!isObject(levelPowers)) {
      throw new Error(
        `Expected level "${level}" in "${discipline}"${path ? ` / "${path}"` : ""} to be an object.`,
      );
    }

    for (const [powerName, power] of Object.entries(levelPowers)) {
      if (!isObject(power)) {
        throw new Error(
          `Expected power "${powerName}" at level "${level}" in "${discipline}"${path ? ` / "${path}"` : ""} to be an object.`,
        );
      }

      rows.push({
        discipline,
        path: path || "—",
        level,
        power: powerName,
        pool: hasField(power, "pool"),
        cost: hasField(power, "cost"),
        effect: hasField(power, "effect"),
        duration: hasField(power, "duration"),
        mechanics: hasField(power, "mechanics"),
      });
    }
  }
}

function main(): void {
  const rulesPath = resolve(process.cwd(), "public/vampires/rules.json");
  const rules = JSON.parse(readFileSync(rulesPath, "utf8")) as unknown;

  if (!isObject(rules) || !isObject(rules.disciplines)) {
    throw new Error(`Expected "${rulesPath}" to contain a disciplines object.`);
  }

  const disciplineEntries = Object.entries(rules.disciplines);
  const rows: AuditRow[] = [];

  for (const [disciplineName, discipline] of disciplineEntries) {
    if (!isObject(discipline)) {
      throw new Error(`Expected discipline "${disciplineName}" to be an object.`);
    }

    collectPowers(rows, disciplineName, "", discipline.powers);

    if (discipline.paths === undefined) {
      continue;
    }

    if (!isObject(discipline.paths)) {
      throw new Error(`Expected paths for "${disciplineName}" to be an object.`);
    }

    for (const [pathName, path] of Object.entries(discipline.paths)) {
      if (!isObject(path)) {
        throw new Error(
          `Expected path "${pathName}" in "${disciplineName}" to be an object.`,
        );
      }

      collectPowers(rows, disciplineName, pathName, getPowerContainer(path));
    }
  }

  console.log(`Discipline rules audit: ${rulesPath}\n`);
  console.table(rows);

  const powersWithMechanics = rows.filter(
    (row) => row.mechanics === "yes",
  ).length;

  console.log("\nSummary");
  console.log(`- disciplines: ${disciplineEntries.length}`);
  console.log(`- powers: ${rows.length}`);
  console.log(`- powers with mechanics: ${powersWithMechanics}`);
  console.log(`- powers without mechanics: ${rows.length - powersWithMechanics}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Discipline audit failed: ${message}`);
  process.exitCode = 1;
}
