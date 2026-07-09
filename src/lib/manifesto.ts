// The manifesto is authored by the team as a regular Docs document (shared
// publicly) and fetched here at build time via the public, unauthenticated
// `formatted-content` API of a Docs instance — same approach as the roadmap,
// see ../lib/roadmap.ts.

const DOCUMENT_URL = 'https://docs.numerique.gouv.fr/api/v1.0/documents/';
const HTML_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=html`;

export const MANIFESTO_ID = '333ad8f7-03af-4296-98a5-1ebb321fdf52';

let cache: Promise<string> | null = null;

export function fetchManifestoHtml(): Promise<string> {
  if (!cache) {
    cache = (async () => {
      const res = await fetch(HTML_URL(MANIFESTO_ID));
      if (!res.ok) {
        throw new Error(`Failed to fetch manifesto document: ${res.status}`);
      }
      const payload = await res.json();
      const content = payload.content;
      if (!content) throw new Error('No content returned for manifesto document');

      return (
        content
          // The Docs HTML export emits a bare <table>; reuse our existing
          // .deps-table styling instead of adding new CSS just for this.
          .replace(/<table>/g, '<div class="table-wrap"><table class="deps-table">')
          .replace(/<\/table>/g, '</table></div>')
          // One figure in the doc was pasted with its author's local dev
          // URL instead of a real one; point it back at the asset we
          // already ship for it.
          .replaceAll(
            'http://localhost:4321/assets/manifesto/libreoffice-writer.webp',
            'assets/manifesto/libreoffice-writer.webp'
          )
      );
    })();
  }
  return cache;
}
