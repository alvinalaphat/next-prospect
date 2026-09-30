/**
 * Minimal robots.txt evaluator (RFC 9309): picks the most specific matching
 * user-agent group (falling back to "*"), then applies longest-match
 * Allow/Disallow with support for "*" and "$" wildcards.
 */
export function isAllowedByRobots(robotsTxt: string, agentToken: string, path: string): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === 'allow' || field === 'disallow') {
      lastWasAgent = false;
      if (!current) continue;
      // An empty Disallow means "allow everything" — skip it.
      if (field === 'disallow' && value === '') continue;
      current.rules.push({ allow: field === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }

  const token = agentToken.toLowerCase();
  const matching = groups.filter((g) =>
    g.agents.some((a) => a !== '*' && token.includes(a))
  );
  const selected = matching.length > 0 ? matching : groups.filter((g) => g.agents.includes('*'));
  const rules = selected.flatMap((g) => g.rules);

  let best: { allow: boolean; len: number } | null = null;
  for (const rule of rules) {
    if (!matchesPattern(rule.pattern, path)) continue;
    const len = rule.pattern.length;
    // Longest match wins; on a tie, Allow wins.
    if (!best || len > best.len || (len === best.len && rule.allow)) {
      best = { allow: rule.allow, len };
    }
  }
  return best ? best.allow : true;
}

function matchesPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    '^' +
      body
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      (anchored ? '$' : '')
  );
  return regex.test(path);
}
