export interface SecretDetectionResult {
  redactedText: string;
  count: number;
  kinds: string[];
}

interface SecretPattern {
  kind: string;
  regex: RegExp;
  replacement: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    kind: 'OpenAI / Anthropic Key',
    regex: /\bsk-(?:proj-|ant-[a-z0-9_-]*|live-|test-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    kind: 'GitHub Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    kind: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  {
    kind: 'Bearer Token',
    regex: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi,
    replacement: '$1[REDACTED_TOKEN]',
  },
  {
    kind: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    kind: 'Env Secret Assignment',
    regex: /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*=\s*(['"]?)[^\s'"]{6,}\2/g,
    replacement: '$1=[REDACTED]',
  },
];

/**
 * Scans text for common credentials/secrets and returns a redacted copy plus match statistics.
 */
export function detectAndRedactSecrets(text: string): SecretDetectionResult {
  if (!text) return { redactedText: text, count: 0, kinds: [] };
  let redacted = text;
  let totalCount = 0;
  const foundKinds: string[] = [];

  for (const pat of SECRET_PATTERNS) {
    const matches = redacted.match(pat.regex);
    if (matches && matches.length > 0) {
      totalCount += matches.length;
      if (!foundKinds.includes(pat.kind)) {
        foundKinds.push(pat.kind);
      }
      redacted = redacted.replace(pat.regex, pat.replacement);
    }
  }

  return {
    redactedText: redacted,
    count: totalCount,
    kinds: foundKinds,
  };
}
