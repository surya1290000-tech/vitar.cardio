'use client';

export default function Hero() {
  const html = `<section class="hero" id="home">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="hero-inner">
    <div class="hero-content">
      <div class="eyebrow">Medical-Grade Cardiac Intelligence</div>
      <div class="hero-status">Platform currently under development</div>
      <h1 class="hero-title">Your heart.<br><em>Protected.</em><br>Always.</h1>
      <p class="hero-sub">VITAR detects early warning signs of cardiac events in real time — alerting you, your contacts, and emergency services before it's too late.</p>
      <div class="hero-actions">
        <a href="/signup" class="btn-p">Get Started Free</a>
        <a href="#how" class="btn-g">How It Works</a>
      </div>
      <div class="hero-stats">
        <div><div class="stat-v">98<span>%</span></div><div class="stat-l">Detection Accuracy</div></div>
        <div><div class="stat-v">8<span>s</span></div><div class="stat-l">Alert Response</div></div>
        <div><div class="stat-v">72<span>hr</span></div><div class="stat-l">Battery Life</div></div>
      </div>
    </div>
    <div class="hero-visual">
      <div class="device-scene">
        <div class="d-glow"></div>
        <div class="d-ring"></div>
        <div class="d-ring"></div>
        <div class="d-ring"></div>
        <div class="d-body">
          <div class="d-screen">
            <svg class="ecg-svg" viewBox="0 0 130 40">
              <path class="ecg-path" d="M0,20 L20,20 L25,5 L30,35 L35,5 L40,20 L50,20 L55,15 L60,20 L80,20 L85,8 L90,32 L95,8 L100,20 L130,20"/>
            </svg>
            <div class="hr-num">74</div>
            <div class="hr-u">BPM · NORMAL</div>
            <div class="s-dots">
              <div class="s-dot"></div>
              <div class="s-dot"></div>
              <div class="s-dot"></div>
            </div>
          </div>
        </div>
        <div class="d-band t"></div>
        <div class="d-band b"></div>
        <div class="a-card c1">
          <div class="a-ico g">✓</div>
          <div><div class="a-t">Rhythm Normal</div><div class="a-s">Sinus rhythm detected</div></div>
        </div>
        <div class="a-card c2">
          <div class="a-ico b">○₂</div>
          <div><div class="a-t">SpO₂ 99%</div><div class="a-s">Oxygen saturation optimal</div></div>
        </div>
        <div class="a-card c3">
          <div class="a-ico r">⚡</div>
          <div><div class="a-t">ECG Monitoring</div><div class="a-s">Continuous · 24/7 active</div></div>
        </div>
      </div>
    </div>
  </div>
</section>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
