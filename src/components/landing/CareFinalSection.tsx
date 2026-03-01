import Link from 'next/link';
import Heart3D from '@/components/care/Heart3D';
import { ButtonLink } from '@/components/ui/Button';

export default function CareFinalSection() {
  return (
    <section className="care-final">
      <div className="sec-in care-final-inner">
        <div className="care-final-visual">
          <Heart3D />
        </div>

        <div className="care-final-copy">
          <div className="s-eye">CARE + ASSISTANT</div>
          <h2 className="care-final-title">
            Real-time support for your <em>cardiac journey</em>.
          </h2>
          <p className="care-final-sub">
            Connect with VITAR Health Assistant for symptom guidance, instant triage tips, and clear next steps. Raise support
            tickets and track replies in one secure care workspace.
          </p>

          <div className="care-final-cards">
            <article>
              <h3>Health Assistant</h3>
              <p>Symptom triage, heart-health routines, and personalized guidance using your latest wearable readings.</p>
            </article>
            <article>
              <h3>Customer Support</h3>
              <p>Create tickets, chat on each request, and get structured updates until your issue is fully resolved.</p>
            </article>
            <article>
              <h3>Urgent Escalation</h3>
              <p>If severe symptoms are detected, the assistant prioritizes emergency-first instructions immediately.</p>
            </article>
          </div>

          <div className="care-final-actions">
            <ButtonLink href="/care-center" variant="neon" size="md" className="neon-cta">
              Open Care Center
            </ButtonLink>
            <Link href="/dashboard" className="care-final-link">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
