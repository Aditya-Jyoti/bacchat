/** Tiny helpers for reading WebDAV and S3 XML replies without an XML library. */

export function xmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Text of the first <tag> (any namespace prefix) in `xml`, or null. */
export function firstTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i').exec(xml);
  return m ? xmlDecode(m[1].trim()) : null;
}

/** Every element <tag>...</tag> (any prefix), as raw inner XML. */
export function allTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

export function hasTag(xml: string, tag: string): boolean {
  return new RegExp(`<(?:[\\w-]+:)?${tag}[\\s/>]`, 'i').test(xml);
}
