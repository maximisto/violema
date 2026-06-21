import Features from '../components/Features';
import Footer from '../components/Footer';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Navbar from '../components/Navbar';
import Pricing from '../components/Pricing';
import SignalBand from '../components/SignalBand';
import { useTheme } from '../lib/useTheme';

export default function Landing() {
  const { scopeClass } = useTheme();
  return (
    <div className={`min-h-screen overflow-x-hidden bg-[#070b16] text-[#f4f1ec] ${scopeClass}`}>
      <Navbar />
      <main>
        <Hero />
        <SignalBand />
        <Integrations />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
