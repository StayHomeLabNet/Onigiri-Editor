import type { SyntaxColorMap, SyntaxPresetId, ThemeId } from '../types';

export const SYNTAX_PRESETS: Record<Exclude<SyntaxPresetId, 'auto' | 'custom'>, SyntaxColorMap> = {
  github: {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    function: '#8250df',
    type: '#953800',
    variable: '#24292f',
    operator: '#cf222e',
    tag: '#116329',
    property: '#0550ae',
  },
  'one-dark': {
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#7f848e',
    function: '#61afef',
    type: '#e5c07b',
    variable: '#e06c75',
    operator: '#56b6c2',
    tag: '#e06c75',
    property: '#d19a66',
  },
  dracula: {
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    comment: '#6272a4',
    function: '#50fa7b',
    type: '#8be9fd',
    variable: '#f8f8f2',
    operator: '#ff79c6',
    tag: '#ff79c6',
    property: '#66d9ef',
  },
  nord: {
    keyword: '#81a1c1',
    string: '#a3be8c',
    number: '#b48ead',
    comment: '#616e88',
    function: '#88c0d0',
    type: '#8fbcbb',
    variable: '#d8dee9',
    operator: '#81a1c1',
    tag: '#81a1c1',
    property: '#88c0d0',
  },
  monokai: {
    keyword: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    comment: '#75715e',
    function: '#a6e22e',
    type: '#66d9ef',
    variable: '#f8f8f2',
    operator: '#f92672',
    tag: '#f92672',
    property: '#66d9ef',
  },
  solarized: {
    keyword: '#859900',
    string: '#2aa198',
    number: '#d33682',
    comment: '#93a1a1',
    function: '#268bd2',
    type: '#b58900',
    variable: '#cb4b16',
    operator: '#657b83',
    tag: '#268bd2',
    property: '#2aa198',
  },
};

export function getAutoPresetForTheme(theme: ThemeId): Exclude<SyntaxPresetId, 'auto' | 'custom'> {
  switch (theme) {
    case 'dark':
      return 'one-dark';
    case 'midnight':
      return 'dracula';
    case 'sepia':
      return 'solarized';
    default:
      return 'github';
  }
}

export function resolveSyntaxColors(
  preset: SyntaxPresetId,
  theme: ThemeId,
  customColors?: Partial<SyntaxColorMap>
): SyntaxColorMap {
  if (preset === 'custom') {
    const base = SYNTAX_PRESETS[getAutoPresetForTheme(theme)];
    return { ...base, ...(customColors || {}) };
  }
  const key = preset === 'auto' ? getAutoPresetForTheme(theme) : preset;
  return SYNTAX_PRESETS[key] || SYNTAX_PRESETS.github;
}

export function syntaxColorsToCssVars(colors: SyntaxColorMap): Record<string, string> {
  return {
    '--syn-keyword': colors.keyword,
    '--syn-string': colors.string,
    '--syn-number': colors.number,
    '--syn-comment': colors.comment,
    '--syn-function': colors.function,
    '--syn-type': colors.type,
    '--syn-variable': colors.variable,
    '--syn-operator': colors.operator,
    '--syn-tag': colors.tag,
    '--syn-property': colors.property,
  };
}
