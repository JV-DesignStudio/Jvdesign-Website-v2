/* JVDS Code Snippet Generator - zero-dependency tokenizer (A2774)
   Small, targeted regex rules for the languages the studio teaches.
   No Prism, no CDN, no build step. Works in the page and in a Web Worker. */
(function (root) {
  'use strict';

  var KEYWORDS = {
    js: 'const let var function return if else for while do switch case break continue new class extends super this try catch finally throw typeof instanceof in of async await yield import export default null true false undefined static get set delete void',
    py: 'def class return if elif else for while in not is and or import from as try except finally raise with lambda pass break continue global nonlocal assert del yield async await None True False',
    gdscript: 'extends class_name func var const if elif else for while in match return break continue pass true false null and or not is as self signal await yield static enum class super preload',
    luau: 'local function end if then else elseif for while do return break true false nil and or not in repeat until continue export type',
    csharp: 'using namespace public private protected internal static void int float double bool string char class struct interface enum new return if else for foreach while do switch case break continue try catch finally throw this base override virtual abstract readonly const async await get set var true false null in out ref params',
    java: 'import package public private protected static void int float double boolean char long short byte class interface enum extends implements new return if else for while do switch case break continue try catch finally throw this super final abstract true false null instanceof',
    cpp: 'include using namespace std public private protected static void int float double bool char long short unsigned class struct enum new return if else for while do switch case break continue try catch throw this const auto true false nullptr',
    gml: 'var function return if else for while do switch case break continue new delete with repeat until true false undefined globalvar self other'
  };

  var STR = {
    js: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y,
    py: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y,
    gdscript: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y,
    luau: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\]/y,
    csharp: /@"(?:[^"]|"")*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y,
    java: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y,
    cpp: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y,
    gml: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y
  };

  var COMMENT = {
    js: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y,
    py: /#[^\n]*/y,
    gdscript: /#[^\n]*/y,
    luau: /--(?:\[\[[\s\S]*?\]\])?[^\n]*/y,
    csharp: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y,
    java: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y,
    cpp: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y,
    gml: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y
  };

  var ALIAS = {
    javascript: 'js',
    phaser: 'js',
    maker: 'js',
    defold: 'luau',
    lua: 'luau',
    godotcs: 'csharp',
    'c#': 'csharp',
    'c++': 'cpp',
    python: 'py',
    gd: 'gdscript'
  };

  var RULES = {};
  function rulesFor(lang) {
    if (RULES[lang]) return RULES[lang];
    var kw = (KEYWORDS[lang] || '').split(/\s+/).filter(Boolean);
    var list = [
      ['comment', COMMENT[lang]],
      ['string', STR[lang]],
      ['number', /(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)[fFdDmMuUlL]*/y]
    ];
    if (kw.length) list.push(['keyword', new RegExp('(?:' + kw.join('|') + ')\\b', 'y')]);
    if (lang === 'gdscript') list.push(['builtin', /@\w+/y]);
    list.push(['fn', /[A-Za-z_$][\w$]*(?=\s*\()/y]);
    list.push(['operator', /[+\-*/%=<>!&|^~?:]+/y]);
    list.push(['punct', /[{}[\]();,.]/y]);
    list.push(['ident', /[A-Za-z_$][\w$]*/y]);
    list.push(['space', /\s+/y]);
    RULES[lang] = list;
    return list;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function normalise(lang) {
    var l = String(lang || '').toLowerCase();
    l = ALIAS[l] || l;
    return KEYWORDS[l] ? l : 'plain';
  }

  function tokenizeLine(line, lang) {
    if (lang === 'plain') return esc(line);
    var rules = rulesFor(lang);
    var out = '';
    var i = 0;
    while (i < line.length) {
      var matched = false;
      for (var r = 0; r < rules.length; r++) {
        var re = rules[r][1];
        if (!re) continue;
        re.lastIndex = i;
        var m = re.exec(line);
        if (m && m.index === i && m[0].length) {
          out += '<span class="tok tok-' + rules[r][0] + '">' + esc(m[0]) + '</span>';
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        out += esc(line[i]);
        i += 1;
      }
    }
    return out;
  }

  function lines(code, lang) {
    var l = normalise(lang);
    return String(code == null ? '' : code).split('\n').map(function (line) {
      return tokenizeLine(line, l);
    });
  }

  var api = { lines: lines, tokenizeLine: tokenizeLine, normalise: normalise };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root = root || (typeof self !== 'undefined' ? self : this);
  root.CSGHighlight = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
