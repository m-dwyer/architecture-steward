import type { StewardConfig } from "./types.ts";

export function exportDependencyCruiserConfig(config: StewardConfig): string {
  const forbidden = config.rules
    .filter((rule) => rule.type === "forbid")
    .map((rule) => {
      const fromZone = config.zones.find((zone) => zone.name === rule.from);
      const toZone = config.zones.find((zone) => zone.name === rule.to);
      return {
        name: rule.id,
        severity: rule.severity,
        comment: rule.description ?? `${rule.from} must not depend on ${rule.to}`,
        from: { path: patternsToDependencyCruiserPath(fromZone?.patterns ?? []) },
        to: { path: patternsToDependencyCruiserPath(toZone?.patterns ?? []) },
      };
    });

  return `${JSON.stringify({ forbidden }, null, 2)}\n`;
}

function patternsToDependencyCruiserPath(patterns: string[]): string {
  const alternatives = patterns.map((pattern) =>
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, ".*"),
  );
  return alternatives.length === 1 ? alternatives[0] : `(${alternatives.join("|")})`;
}
