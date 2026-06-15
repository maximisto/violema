import Features from '../components/Features';
import Footer from '../components/Footer';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Navbar from '../components/Navbar';
import Pricing from '../components/Pricing';
import SignalBand from '../components/SignalBand';

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b16] text-[#f4f1ec]">
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
