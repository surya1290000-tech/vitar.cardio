'use client';

export default function Preloader() {
  const html = '<div class="preloader" id="preloader">\n  <div class="pl-logo">VITAR<span>.</span></div>\n  <div class="pl-bar"></div>\n</div>';
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
