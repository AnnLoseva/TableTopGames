import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type Summary = {
  totalPowers: number;
  auto: number;
  partial: number;
  manual: number;
  missingMechanics: number;
};

type AutomationStatus = "auto" | "partial" | "manual";

const REQUIRED_AUTO_FIELDS = [
  "identity",
  "activation",
  "cost",
  "duration",
  "effects",
  "ui",
] as const;

const EFFECT_TYPES = new Set([
  "tracker_modifier",
  "roll_modifier",
  "damage_modifier",
  "weapon_effect",
  "condition",
  "entity",
  "feeding_modifier",
  "transformation",
  "movement",
  "sense",
  "manual_prompt",
]);

const ROLL_OPERATIONS = new Set([
  "add",
  "subtract",
  "set",
  "multiply",
  "add_dice",
  "remove_dice",
  "difficulty_modifier",
  "ignore_penalty",
  "auto_success",
]);

const DAMAGE_OPERATIONS = new Set([
  "add",
  "subtract",
  "set",
  "multiply",
  "add_damage",
  "set_damage",
  "subtract_before_halving",
  "subtract_after_halving",
  "convert_damage_type",
  "ignore_armor",
  "ignore_halving",
  "prevent_damage",
  "prevent_first_attack",
]);

const TRACKER_OPERATIONS = new Set([
  "add",
  "add_max",
  "subtract",
  "set",
  "min",
  "max",
]);

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasValue = (object: JsonObject, field: string): boolean => {
  if (!Object.prototype.hasOwnProperty.call(object, field)) {
    return false;
  }

  const value = object[field];
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
};

const hasNonEmptyArray = (object: JsonObject, field: string): boolean =>
  Array.isArray(object[field]) && (object[field] as unknown[]).length > 0;

const hasAnyValue = (object: JsonObject, fields: string[]): boolean =>
  fields.some((field) => hasValue(object, field));

const isStringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const formatPowerLocation = (
  discipline: string,
  path: string,
  level: string,
  power: string,
): string =>
  [discipline, path, `level ${level}`, power].filter(Boolean).join(" / ");

function getPowerContainer(value: JsonObject): unknown {
  if (isObject(value.powers)) return value.powers;
  const levelEntries = Object.entries(value).filter(([key]) =>
    Number.isFinite(Number(key))
  );
  return levelEntries.length > 0
    ? Object.fromEntries(levelEntries)
    : undefined;
}

function validateStringArrayField(
  effect: JsonObject,
  field: string,
  location: string,
  errors: string[],
): void {
  const value = effect[field];
  if (value !== undefined && !isStringArray(value)) {
    errors.push(`${location}: ${field} must be an array of strings.`);
  }
}

function validateMatcher(
  matcher: unknown,
  location: string,
  errors: string[],
): void {
  if (matcher === undefined) {
    return;
  }

  if (!isObject(matcher)) {
    errors.push(`${location}: matcher must be an object.`);
    return;
  }

  for (const field of [
    "kinds",
    "poolTypes",
    "traits",
    "actions",
    "sources",
    "weaponTags",
    "conditions",
    "owners",
    "targets",
    "severities",
    "attackTypes",
    "creatureTypes",
  ]) {
    validateStringArrayField(matcher, field, `${location}.matcher`, errors);
  }
}

function validateFormulaValue(
  value: unknown,
  location: string,
  errors: string[],
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === "number" || typeof value === "string") {
    return;
  }

  if (!isObject(value)) {
    errors.push(`${location}: formula value must be a number, string, or object.`);
    return;
  }

  if (value.type === "trait" && typeof value.trait !== "string") {
    errors.push(`${location}: trait formula must include a string trait.`);
  }
  if (value.type === "formula" && typeof value.expression !== "string") {
    errors.push(`${location}: expression formula must include a string expression.`);
  }
  if (
    value.formula !== undefined
    && typeof value.formula !== "string"
  ) {
    errors.push(`${location}: formula must be a string.`);
  }
}

function validateEffect(
  effect: unknown,
  location: string,
  errors: string[],
): void {
  if (!isObject(effect)) {
    errors.push(`${location}: effect must be an object.`);
    return;
  }

  if (typeof effect.type !== "string" || !EFFECT_TYPES.has(effect.type)) {
    errors.push(`${location}: effect.type is invalid or missing.`);
    return;
  }

  if (effect.id !== undefined && typeof effect.id !== "string") {
    errors.push(`${location}: effect.id must be a string.`);
  }
  if (effect.label !== undefined && typeof effect.label !== "string") {
    errors.push(`${location}: effect.label must be a string.`);
  }
  if (
    effect.description !== undefined
    && typeof effect.description !== "string"
  ) {
    errors.push(`${location}: effect.description must be a string.`);
  }
  if (effect.payload !== undefined && !isObject(effect.payload)) {
    errors.push(`${location}: effect.payload must be an object.`);
  }

  switch (effect.type) {
    case "tracker_modifier":
      if (typeof effect.tracker !== "string" || effect.tracker.trim() === "") {
        errors.push(`${location}: tracker_modifier requires tracker.`);
      }
      if (
        typeof effect.operation !== "string"
        || !TRACKER_OPERATIONS.has(effect.operation)
      ) {
        errors.push(`${location}: tracker_modifier operation is invalid or missing.`);
      }
      if (!hasAnyValue(effect, ["value", "amount"])) {
        errors.push(`${location}: tracker_modifier requires value or amount.`);
      }
      validateFormulaValue(effect.value ?? effect.amount, `${location}.value`, errors);
      break;

    case "roll_modifier":
      validateMatcher(effect.matcher, location, errors);
      if (
        effect.operation !== undefined
        && (
          typeof effect.operation !== "string"
          || !ROLL_OPERATIONS.has(effect.operation)
        )
      ) {
        errors.push(`${location}: roll_modifier operation is invalid.`);
      }
      validateFormulaValue(effect.value ?? effect.amount, `${location}.value`, errors);
      if (
        effect.penalty !== undefined
        && typeof effect.penalty !== "string"
      ) {
        errors.push(`${location}: roll_modifier penalty must be a string.`);
      }
      validateStringArrayField(effect, "penalties", location, errors);
      break;

    case "damage_modifier":
      validateMatcher(effect.matcher, location, errors);
      if (
        effect.operation !== undefined
        && (
          typeof effect.operation !== "string"
          || !DAMAGE_OPERATIONS.has(effect.operation)
        )
      ) {
        errors.push(`${location}: damage_modifier operation is invalid.`);
      }
      validateFormulaValue(effect.value ?? effect.amount, `${location}.value`, errors);
      if (
        effect.severity !== undefined
        && effect.severity !== "superficial"
        && effect.severity !== "aggravated"
      ) {
        errors.push(`${location}: damage_modifier severity is invalid.`);
      }
      if (
        effect.setSeverity !== undefined
        && effect.setSeverity !== "superficial"
        && effect.setSeverity !== "aggravated"
      ) {
        errors.push(`${location}: damage_modifier setSeverity is invalid.`);
      }
      break;

    case "weapon_effect":
      validateStringArrayField(effect, "weaponTags", location, errors);
      validateStringArrayField(effect, "grantedTags", location, errors);
      validateFormulaValue(effect.damageBonus, `${location}.damageBonus`, errors);
      if (
        effect.damageSeverity !== undefined
        && effect.damageSeverity !== "superficial"
        && effect.damageSeverity !== "aggravated"
      ) {
        errors.push(`${location}: weapon_effect damageSeverity is invalid.`);
      }
      if (effect.properties !== undefined && !isObject(effect.properties)) {
        errors.push(`${location}: weapon_effect properties must be an object.`);
      }
      break;

    case "condition":
      if (
        typeof effect.condition !== "string"
        || effect.condition.trim() === ""
      ) {
        errors.push(`${location}: condition effect requires condition.`);
      }
      if (
        effect.action !== undefined
        && effect.action !== "apply"
        && effect.action !== "remove"
      ) {
        errors.push(`${location}: condition action is invalid.`);
      }
      validateFormulaValue(effect.stacks, `${location}.stacks`, errors);
      break;

    case "entity":
      if (
        typeof effect.entityType !== "string"
        || effect.entityType.trim() === ""
      ) {
        errors.push(`${location}: entity effect requires entityType.`);
      }
      if (effect.traits !== undefined && !isObject(effect.traits)) {
        errors.push(`${location}: entity traits must be an object.`);
      }
      if (effect.properties !== undefined && !isObject(effect.properties)) {
        errors.push(`${location}: entity properties must be an object.`);
      }
      break;

    case "feeding_modifier":
      validateMatcher(effect.matcher, location, errors);
      if (
        effect.operation !== undefined
        && effect.operation !== "add_satiation"
        && effect.operation !== "set_satiation"
      ) {
        errors.push(`${location}: feeding_modifier operation is invalid.`);
      }
      if (!hasAnyValue(effect, ["value", "amount"])) {
        errors.push(`${location}: feeding_modifier requires value or amount.`);
      }
      validateFormulaValue(effect.value ?? effect.amount, `${location}.value`, errors);
      break;

    case "transformation":
      if (typeof effect.form !== "string" || effect.form.trim() === "") {
        errors.push(`${location}: transformation requires form.`);
      }
      validateStringArrayField(effect, "grantedTraits", location, errors);
      validateStringArrayField(effect, "suppressedTraits", location, errors);
      if (
        effect.derivedStats !== undefined
        && !isObject(effect.derivedStats)
      ) {
        errors.push(`${location}: transformation derivedStats must be an object.`);
      }
      break;

    case "movement":
      if (typeof effect.mode !== "string" || effect.mode.trim() === "") {
        errors.push(`${location}: movement requires mode.`);
      }
      validateFormulaValue(effect.speed, `${location}.speed`, errors);
      validateFormulaValue(effect.multiplier, `${location}.multiplier`, errors);
      break;

    case "sense":
      if (typeof effect.sense !== "string" || effect.sense.trim() === "") {
        errors.push(`${location}: sense effect requires sense.`);
      }
      validateFormulaValue(effect.range, `${location}.range`, errors);
      validateFormulaValue(effect.rollModifier, `${location}.rollModifier`, errors);
      validateStringArrayField(effect, "tags", location, errors);
      break;

    case "manual_prompt":
      if (typeof effect.message !== "string" || effect.message.trim() === "") {
        errors.push(`${location}: manual_prompt requires message.`);
      }
      if (effect.choices !== undefined && !Array.isArray(effect.choices)) {
        errors.push(`${location}: manual_prompt choices must be an array.`);
      }
      break;
  }
}

function validateAutoEffects(
  mechanics: JsonObject,
  location: string,
  errors: string[],
): void {
  if (!Array.isArray(mechanics.effects)) {
    errors.push(`${location}: auto mechanics.effects must be an array.`);
    return;
  }

  if (mechanics.effects.length === 0) {
    errors.push(`${location}: auto mechanics.effects must not be empty.`);
    return;
  }

  mechanics.effects.forEach((effect, index) => {
    validateEffect(effect, `${location}: effects[${index}]`, errors);
  });
}

function validatePower(
  discipline: string,
  path: string,
  level: string,
  powerName: string,
  power: JsonObject,
  summary: Summary,
  errors: string[],
): void {
  summary.totalPowers += 1;
  const location = formatPowerLocation(discipline, path, level, powerName);

  if (!Object.prototype.hasOwnProperty.call(power, "mechanics")) {
    summary.missingMechanics += 1;
    errors.push(`${location}: missing mechanics.`);
    return;
  }

  if (!isObject(power.mechanics)) {
    errors.push(`${location}: mechanics must be an object.`);
    return;
  }

  const mechanics = power.mechanics;
  if (mechanics.automation === undefined) {
    errors.push(`${location}: mechanics.automation is missing.`);
    return;
  }

  if (!isObject(mechanics.automation)) {
    errors.push(`${location}: mechanics.automation must be an object.`);
    return;
  }

  const status = mechanics.automation.status;
  if (status !== "auto" && status !== "partial" && status !== "manual") {
    errors.push(
      `${location}: mechanics.automation.status must be "auto", "partial", or "manual".`,
    );
    return;
  }

  summary[status as AutomationStatus] += 1;

  if (status !== "auto") {
    if (!hasValue(mechanics.automation, "reason")) {
      errors.push(
        `${location}: ${status} mechanics must include mechanics.automation.reason.`,
      );
    }
    return;
  }

  const missingFields = REQUIRED_AUTO_FIELDS.filter(
    (field) => field === "effects"
      ? !hasNonEmptyArray(mechanics, field)
      : !hasValue(mechanics, field),
  );

  if (missingFields.length > 0) {
    errors.push(
      `${location}: auto mechanics is missing required fields: ${missingFields.join(", ")}.`,
    );
  }

  validateAutoEffects(mechanics, location, errors);
}

function validatePowers(
  discipline: string,
  path: string,
  powers: unknown,
  summary: Summary,
  errors: string[],
): void {
  if (powers === undefined) {
    return;
  }

  if (!isObject(powers)) {
    errors.push(
      `${discipline}${path ? ` / ${path}` : ""}: powers must be an object.`,
    );
    return;
  }

  for (const [level, levelPowers] of Object.entries(powers)) {
    if (!isObject(levelPowers)) {
      errors.push(
        `${discipline}${path ? ` / ${path}` : ""} / level ${level}: powers must be an object.`,
      );
      continue;
    }

    for (const [powerName, power] of Object.entries(levelPowers)) {
      if (!isObject(power)) {
        errors.push(
          `${formatPowerLocation(discipline, path, level, powerName)}: power must be an object.`,
        );
        continue;
      }

      validatePower(
        discipline,
        path,
        level,
        powerName,
        power,
        summary,
        errors,
      );
    }
  }
}

function main(): void {
  const rulesPath = resolve(process.cwd(), "public/vampires/rules.json");
  const rules = JSON.parse(readFileSync(rulesPath, "utf8")) as unknown;

  if (!isObject(rules) || !isObject(rules.disciplines)) {
    throw new Error(`Expected "${rulesPath}" to contain a disciplines object.`);
  }

  const summary: Summary = {
    totalPowers: 0,
    auto: 0,
    partial: 0,
    manual: 0,
    missingMechanics: 0,
  };
  const errors: string[] = [];

  console.log(`Discipline mechanics validation: ${rulesPath}\n`);

  for (const [disciplineName, discipline] of Object.entries(
    rules.disciplines,
  )) {
    if (!isObject(discipline)) {
      errors.push(`${disciplineName}: discipline must be an object.`);
      continue;
    }

    validatePowers(
      disciplineName,
      "",
      discipline.powers,
      summary,
      errors,
    );

    if (discipline.paths === undefined) {
      continue;
    }

    if (!isObject(discipline.paths)) {
      errors.push(`${disciplineName}: paths must be an object.`);
      continue;
    }

    for (const [pathName, path] of Object.entries(discipline.paths)) {
      if (!isObject(path)) {
        errors.push(`${disciplineName} / ${pathName}: path must be an object.`);
        continue;
      }

      validatePowers(
        disciplineName,
        pathName,
        getPowerContainer(path),
        summary,
        errors,
      );
    }
  }

  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }

  console.log("\nSummary");
  console.log(`- total powers: ${summary.totalPowers}`);
  console.log(`- auto: ${summary.auto}`);
  console.log(`- partial: ${summary.partial}`);
  console.log(`- manual: ${summary.manual}`);
  console.log(`- missing mechanics: ${summary.missingMechanics}`);

  if (errors.length > 0) {
    console.error(`\nValidation failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nValidation passed with full mechanics coverage.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Discipline mechanics validation failed: ${message}`);
  process.exitCode = 1;
}
