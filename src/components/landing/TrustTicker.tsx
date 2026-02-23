'use client';

export default function TrustTicker() {
  const html = '<div class="ticker">\n  <div class="ticker-t">\n    <span class="ticker-i">FDA Submission Pending</span>\n    <span class="ticker-i">CE Mark In Progress</span>\n    <span class="ticker-i">ISO 13485 Compliant Design</span>\n    <span class="ticker-i">HIPAA-Ready Architecture</span>\n    <span class="ticker-i">Clinically Validated Algorithm</span>\n    <span class="ticker-i">256-bit AES Encryption</span>\n    <span class="ticker-i">Medical Advisory Board</span>\n    <span class="ticker-i">24/7 Emergency Protocol</span>\n    <span class="ticker-i">FDA Submission Pending</span>\n    <span class="ticker-i">CE Mark In Progress</span>\n    <span class="ticker-i">ISO 13485 Compliant Design</span>\n    <span class="ticker-i">HIPAA-Ready Architecture</span>\n    <span class="ticker-i">Clinically Validated Algorithm</span>\n    <span class="ticker-i">256-bit AES Encryption</span>\n    <span class="ticker-i">Medical Advisory Board</span>\n    <span class="ticker-i">24/7 Emergency Protocol</span>\n  </div>\n</div>';
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
