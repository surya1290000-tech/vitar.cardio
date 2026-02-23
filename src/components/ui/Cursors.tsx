'use client';

export default function Cursors() {
  const html = '<div class="cursor" id="cursor"></div>\n<div class="cursor-ring" id="cursorRing"></div>';
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
