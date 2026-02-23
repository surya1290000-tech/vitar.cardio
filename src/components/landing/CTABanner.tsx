'use client';

export default function CTABanner() {
  const html = '<section style="background:var(--accent);padding:6rem 5%;text-align:center">\n  <div style="max-width:700px;margin:0 auto">\n    <div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:1rem">Limited Pre-Order · 500 Units</div>\n    <h2 style="font-family:\'DM Serif Display\',serif;font-size:clamp(2rem,4vw,3.5rem);line-height:1.1;margin-bottom:1rem">Don\'t wait for a warning<br>you won\'t have time to act on.</h2>\n    <p style="font-size:.95rem;color:rgba(255,255,255,.8);line-height:1.8;margin-bottom:2.5rem">Secure your VITAR device today. First 500 pre-orders ship Q3 2025.<br>No charge until your device ships.</p>\n    <a href="#" class="btn-p" style="background:var(--deep);color:var(--white);border-radius:3px" onclick="openOrder();return false">Reserve Your Device — From $299</a>\n  </div>\n</section>';
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
