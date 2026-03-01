import Preloader from '@/components/ui/Preloader';
import Cursors from '@/components/ui/Cursors';
import AuthModal from '@/components/ui/AuthModal';
import OrderModal from '@/components/ui/OrderModal';
import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/landing/Hero';
import TrustTicker from '@/components/landing/TrustTicker';
import SensorsSection from '@/components/landing/SensorsSection';
import HowItWorks from '@/components/landing/HowItWorks';
import AlertDemo from '@/components/landing/AlertDemo';
import StatsSection from '@/components/landing/StatsSection';
import PricingSection from '@/components/landing/PricingSection';
import Testimonials from '@/components/landing/Testimonials';
import AuthDashboard from '@/components/landing/AuthDashboard';
import AboutSection from '@/components/landing/AboutSection';
import CTABanner from '@/components/landing/CTABanner';
import CareFinalSection from '@/components/landing/CareFinalSection';
import Footer from '@/components/layout/Footer';
import ClientScripts from '@/components/ui/ClientScripts';

export default function Home() {
  return (
    <>
      <Preloader />
      <Cursors />
      <AuthModal />
      <OrderModal />
      <Navbar />
      <main>
        <Hero />
        <TrustTicker />
        <SensorsSection />
        <HowItWorks />
        <AlertDemo />
        <StatsSection />
        <PricingSection />
        <Testimonials />
        <AuthDashboard />
        <AboutSection />
        <CTABanner />
        <CareFinalSection />
      </main>
      <Footer />
      <ClientScripts />
    </>
  );
}
