import type { Locale, ReviewFinding } from '../types';
import { extractHeadings, splitFrontmatter } from './markdown';

function normalizePosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function resolveRelativePath(baseDirRel: string, linkTarget: string): string {
  const cleanTarget = linkTarget.split('#')[0].split('?')[0].trim();
  const baseParts = baseDirRel ? baseDirRel.split('/').filter(Boolean) : [];
  const targetParts = cleanTarget.replace(/^\.\//, '').split('/');
  const stack = cleanTarget.startsWith('/') ? [] : [...baseParts];
  for (const part of targetParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

export function runLocalDocumentReview(params: {
  markdown: string;
  filePath?: string;
  workspaceRoot?: string | null;
  workspaceFilePaths?: string[];
  locale: Locale;
}): ReviewFinding[] {
  const { markdown, filePath, workspaceRoot, workspaceFilePaths = [], locale } = params;
  const isJa = locale === 'ja';
  const findings: ReviewFinding[] = [];
  let seq = 1;
  const push = (f: Omit<ReviewFinding, 'id'>) => {
    findings.push({ id: `rev-${seq++}`, ...f });
  };

  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const { body } = splitFrontmatter(markdown || '');
  const headings = extractHeadings(markdown || '');
  const headingSlugs = new Set<string>();
  for (const h of headings) {
    const githubSlug = h.text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-');
    if (githubSlug) headingSlugs.add(githubSlug);
    headingSlugs.add(h.id.toLowerCase());
  }

  // Build normalized set of workspace files for link verification
  const normRoot = workspaceRoot ? normalizePosix(workspaceRoot).replace(/\/+$/, '') : '';
  const workspaceRelSet = new Set<string>();
  const workspaceNameSet = new Set<string>();
  for (const p of workspaceFilePaths) {
    const np = normalizePosix(p);
    const name = np.split('/').pop()?.toLowerCase() || '';
    if (name) {
      workspaceNameSet.add(name);
      workspaceNameSet.add(name.replace(/\.[^.]+$/, ''));
    }
    if (normRoot && np.toLowerCase().startsWith(`${normRoot.toLowerCase()}/`)) {
      workspaceRelSet.add(np.slice(normRoot.length + 1).toLowerCase());
    }
  }

  let docRelDir = '';
  if (filePath && normRoot) {
    const normDoc = normalizePosix(filePath);
    if (normDoc.toLowerCase().startsWith(`${normRoot.toLowerCase()}/`)) {
      const rel = normDoc.slice(normRoot.length + 1);
      const parts = rel.split('/');
      parts.pop();
      docRelDir = parts.join('/');
    }
  }

  // 1. Heading structure checks (skipped levels & duplicates)
  let prevLevel = 0;
  const seenHeadingTitle = new Map<string, number>();
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      push({
        line: h.line,
        severity: 'warning',
        category: 'structure',
        title: isJa
          ? `見出しレベルの飛び越し (H${prevLevel} → H${h.level})`
          : `Skipped heading level (H${prevLevel} → H${h.level})`,
        detail: isJa
          ? `「${h.text}」の前に H${prevLevel + 1} がなく階層が飛んでいます。`
          : `Heading "${h.text}" jumps from H${prevLevel} to H${h.level}.`,
      });
    }
    prevLevel = h.level;

    const key = h.text.trim().toLowerCase();
    const firstLine = seenHeadingTitle.get(key);
    if (firstLine !== undefined) {
      push({
        line: h.line,
        severity: 'info',
        category: 'structure',
        title: isJa ? `重複した見出し: 「${h.text}」` : `Duplicate heading: "${h.text}"`,
        detail: isJa
          ? `${firstLine}行目と同じ見出しがあります。アンカーリンクが衝突する可能性があります。`
          : `Matches heading at line ${firstLine}; anchor slugs may collide.`,
      });
    } else {
      seenHeadingTitle.set(key, h.line);
    }
  }

  // 2. Scan lines outside fenced code blocks
  let inFence = false;
  let fenceStartLine = 0;
  let fenceMarker = '';
  let politeCount = 0;
  let plainCount = 0;
  let firstPoliteLine = 0;
  let firstPlainLine = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceStartLine = lineNo;
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        inFence = false;
        fenceStartLine = 0;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    // Empty Markdown links: []() or [text]()
    const emptyLinkMatch = rawLine.match(/(!?\[[^\]]*\]\(\s*\))/);
    if (emptyLinkMatch) {
      push({
        line: lineNo,
        severity: 'error',
        category: 'link',
        title: isJa ? 'リンク先が未指定の Markdown リンク' : 'Empty Markdown link target',
        detail: isJa
          ? `リンクURLまたはパスが空です: ${emptyLinkMatch[1]}`
          : `Link destination is empty: ${emptyLinkMatch[1]}`,
      });
    }

    // Markdown links & images [text](url)
    const linkRegex = /(!?\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(rawLine)) !== null) {
      const target = m[2].trim();
      if (
        !target ||
        /^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(target)
      ) {
        continue;
      }
      if (target.startsWith('#')) {
        const slug = target.slice(1).toLowerCase();
        if (slug && !headingSlugs.has(slug)) {
          push({
            line: lineNo,
            severity: 'error',
            category: 'link',
            title: isJa ? `見出しアンカーリンク切れ: ${target}` : `Broken anchor link: ${target}`,
            detail: isJa
              ? `ドキュメント内に見出しスラッグ「${slug}」が見つかりません。`
              : `No heading matching anchor "#${slug}" was found in this document.`,
          });
        }
      } else if (workspaceRelSet.size > 0 && filePath) {
        const resolvedRel = resolveRelativePath(docRelDir, target).toLowerCase();
        if (resolvedRel && !workspaceRelSet.has(resolvedRel)) {
          push({
            line: lineNo,
            severity: 'warning',
            category: 'link',
            title: isJa ? `ローカルファイルリンク切れの可能性: ${target}` : `Possible broken local link: ${target}`,
            detail: isJa
              ? `作業フォルダー内に「${resolvedRel}」が見つかりません。`
              : `Target "${resolvedRel}" was not found inside the workspace folder.`,
          });
        }
      }
    }

    // Wiki-links [[note]]
    if (workspaceNameSet.size > 0) {
      const wikiRe = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
      let wm: RegExpExecArray | null;
      while ((wm = wikiRe.exec(rawLine)) !== null) {
        const target = wm[1].trim().toLowerCase().replace(/\\/g, '/');
        const base = target.replace(/\.md$/i, '');
        if (!workspaceNameSet.has(base) && !workspaceRelSet.has(`${base}.md`) && !workspaceRelSet.has(target)) {
          push({
            line: lineNo,
            severity: 'warning',
            category: 'link',
            title: isJa ? `Wikiリンク先が見つかりません: [[${wm[1].trim()}]]` : `Unresolved Wiki-link: [[${wm[1].trim()}]]`,
            detail: isJa
              ? `作業フォルダー内に一致するノートがありません。`
              : `No matching Markdown note found in the workspace.`,
          });
        }
      }
    }

    // Trailing spaces (more than 2 or single trailing space)
    if (/[ \t]+$/.test(rawLine) && !/ {2}$/.test(rawLine)) {
      push({
        line: lineNo,
        severity: 'info',
        category: 'consistency',
        title: isJa ? '行末の不要な空白' : 'Trailing whitespace',
        detail: isJa ? '行末に余分なスペースがあります。' : 'Line ends with trailing whitespace.',
        original: rawLine,
        replacement: rawLine.replace(/[ \t]+$/, ''),
      });
    }

    // Repeated English words ("the the", "is is")
    const dupWordMatch = rawLine.match(/\b([a-zA-Z]{2,})\s+\1\b/i);
    if (dupWordMatch) {
      push({
        line: lineNo,
        severity: 'warning',
        category: 'typo',
        title: isJa
          ? `単語の重複: "${dupWordMatch[0]}"`
          : `Repeated word: "${dupWordMatch[0]}"`,
        detail: isJa ? '同じ英単語が連続しています。' : 'Duplicate adjacent word detected.',
        original: dupWordMatch[0],
        replacement: dupWordMatch[1],
      });
    }

    // Repeated Japanese particles ("がが", "をを", "にに", "はは", "でで", "とと")
    const dupKanaMatch = rawLine.match(/([がをにはでとも])(\1)/);
    if (dupKanaMatch && !/は{3,}/.test(rawLine)) {
      push({
        line: lineNo,
        severity: 'warning',
        category: 'typo',
        title: isJa ? `助詞の重複の可能性: 「${dupKanaMatch[0]}」` : `Possible duplicate particle: "${dupKanaMatch[0]}"`,
        detail: isJa ? '同じ助詞が連続している箇所があります。' : 'Adjacent duplicate Japanese particle.',
        original: dupKanaMatch[0],
        replacement: dupKanaMatch[1],
      });
    }

    // Japanese style consistency (敬体 です/ます vs 常体 だ/である) in prose lines
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('>') &&
      !trimmed.startsWith('---')
    ) {
      if (/(?:です|ます|ません|でした|ましょう)[。！？]?$/.test(trimmed)) {
        politeCount += 1;
        if (!firstPoliteLine) firstPoliteLine = lineNo;
      } else if (/(?:である|だった|ない|する|した|できる|いる)[。]?$/.test(trimmed)) {
        plainCount += 1;
        if (!firstPlainLine) firstPlainLine = lineNo;
      }
    }
  }

  if (inFence && fenceStartLine > 0) {
    push({
      line: fenceStartLine,
      severity: 'error',
      category: 'structure',
      title: isJa ? '閉じられていないコードブロック' : 'Unclosed code fence',
      detail: isJa
        ? `${fenceStartLine}行目で開始したコードブロックが閉じられていません。`
        : `Code fence opened at line ${fenceStartLine} is never closed.`,
    });
  }

  if (politeCount > 0 && plainCount > 0) {
    const minorityLine = politeCount < plainCount ? firstPoliteLine : firstPlainLine;
    push({
      line: minorityLine || 1,
      severity: 'warning',
      category: 'consistency',
      title: isJa ? '文体の混在（です・ます調 / だ・である調）' : 'Mixed Japanese writing style (Polite vs Plain)',
      detail: isJa
        ? `敬体（${politeCount}行）と常体（${plainCount}行）が混在しています。文体を統一すると読みやすくなります。`
        : `Document mixes polite (${politeCount} lines) and plain (${plainCount} lines) Japanese endings.`,
    });
  }

  // Punctuation mix check (Japanese comma/period vs half-width/full-width)
  const hasTouten = body.includes('、');
  const hasZenComma = body.includes('，');
  if (hasTouten && hasZenComma) {
    const firstMixIdx = lines.findIndex((l) => l.includes('，'));
    push({
      line: firstMixIdx >= 0 ? firstMixIdx + 1 : 1,
      severity: 'info',
      category: 'consistency',
      title: isJa ? '読点の表記ゆれ（「、」と「，」が混在）' : 'Mixed Japanese commas (、 and ，)',
      detail: isJa
        ? '文書内で「、」と「，」の両方が使われています。どちらかに統一することをおすすめします。'
        : 'Both 「、」 and 「，」 appear in the document.',
    });
  }

  return findings.sort((a, b) => a.line - b.line);
}

export function parseAiReviewFindings(rawContent: string): ReviewFinding[] {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) {
    throw new Error('AI response did not contain a valid JSON findings array.');
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const rec = item as Record<string, unknown>;
      const sev = rec.severity === 'error' || rec.severity === 'warning' || rec.severity === 'info' ? rec.severity : 'info';
      const cat =
        rec.category === 'link' ||
        rec.category === 'consistency' ||
        rec.category === 'structure' ||
        rec.category === 'typo'
          ? rec.category
          : 'ai';
      return {
        id: `ai-rev-${idx + 1}`,
        line: typeof rec.line === 'number' && rec.line > 0 ? Math.floor(rec.line) : 1,
        severity: sev,
        category: cat,
        title: String(rec.title || 'AI Suggestion'),
        detail: String(rec.detail || ''),
        original: typeof rec.original === 'string' && rec.original ? rec.original : undefined,
        replacement: typeof rec.replacement === 'string' ? rec.replacement : undefined,
      };
    });
}
