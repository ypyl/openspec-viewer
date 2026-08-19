// html-literal by jsebrech (https://github.com/jsebrech/html-literal)
// Vendored as an ES module (plain vanilla web, no build step).
// A tagged template that entity-encodes interpolations by default, preventing XSS.

export class Html extends String {}

// Opt out of encoding for pre-sanitized HTML (e.g. DOMPurify output).
export const htmlRaw = str => new Html(str);

// Explicitly encode one string. A Value already wrapped in Html is returned
// untouched to avoid double-encoding.
export const htmlEncode = (value) => {
  if (value instanceof Html) return value;
  return htmlRaw(String(value).replace(/[&<>"']/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])));
};

// The default for all markup: encodes interpolations automatically.
export const html = (strings, ...values) =>
  htmlRaw(String.raw({ raw: strings }, ...values.map(htmlEncode)));

// Concatenate an array of html`` fragments into one safe chunk. A plain
// .join('') would lose the Html marker and get re-encoded on interpolation,
// so wrap it back with htmlRaw.
export const joinHtml = parts => htmlRaw(parts.join(''));
