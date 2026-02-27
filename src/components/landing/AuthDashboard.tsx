'use client';

export default function AuthDashboard() {
  const html = `<section class="auth-sec" id="auth">
  <div class="sec-in">
    <div class="auth-g">
      <div>
        <div class="s-eye">Get Started</div>
        <h2 class="auth-t">Your cardiac health dashboard awaits.</h2>
        <p class="auth-s">Join thousands of people monitoring their heart health with VITAR. Create your free account and pre-order your device today.</p>
        <div style="display:flex;flex-direction:column;gap:1rem;margin-top:2rem">
          <a href="/signup" class="btn-p neon-cta" style="text-decoration:none;text-align:center">Create Free Account</a>
          <a href="/login" class="btn-g" style="text-decoration:none;text-align:center">Sign In</a>
        </div>
        <div class="f-dis" style="margin-top:1.5rem">
          Your health data is encrypted end-to-end. We are HIPAA-compliant by design.
          <br/>By creating an account you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </div>
      </div>
      <div>
        <div class="dash reveal">
          <div class="dash-bar">
            <div class="db-dot" style="background:#FF5F57"></div>
            <div class="db-dot" style="background:#FFBD2E"></div>
            <div class="db-dot" style="background:#28CA41"></div>
          </div>
          <div class="dash-body">
            <div class="dash-hd">
              <div>
                <div class="dash-uname">Jordan Mitchell</div>
                <div class="dash-usub">VITAR Pro · Active</div>
              </div>
              <div class="dash-status">Live Monitoring</div>
            </div>
            <div class="dash-mets">
              <div class="dash-m">
                <div class="dm-lbl">Heart Rate</div>
                <div class="dm-val">72</div>
                <div class="dm-unit">BPM</div>
              </div>
              <div class="dash-m">
                <div class="dm-lbl">SpO₂</div>
                <div class="dm-val">98<span style="font-size:.8rem">%</span></div>
                <div class="dm-unit">Oxygen</div>
              </div>
              <div class="dash-m">
                <div class="dm-lbl">AI Risk</div>
                <div class="dm-val w">Low</div>
                <div class="dm-unit">Score</div>
              </div>
            </div>
            <div class="dash-alert">⚡ All vitals normal · Last sync 2 min ago</div>
            <div class="dash-graph">
              <svg width="100%" height="50" viewBox="0 0 300 50">
                <polyline points="0,25 20,25 30,10 40,40 50,10 60,25 80,25 100,25 110,15 120,25 140,25 160,25 170,8 180,42 190,8 200,25 220,25 240,25 250,18 260,25 280,25 300,25" fill="none" stroke="#C0392B" stroke-width="1.5" opacity="0.8"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
