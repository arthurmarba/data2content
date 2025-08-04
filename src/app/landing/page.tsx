import { IntroSlide } from './components/IntroSlide';
import { FeaturesSlide } from './components/FeaturesSlide';
import { ExamplesSlide } from './components/ExamplesSlide';

export default function LandingPage() {
  return (
    <main className="snap-y snap-mandatory h-screen overflow-y-scroll">
      <IntroSlide />
      <FeaturesSlide />
      <ExamplesSlide />
    </main>
  );
}

