import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AppPreview from "@/components/AppPreview";
import Features from "@/components/Features";
import ThreeViews from "@/components/ThreeViews";
import Stats from "@/components/Stats";
import Cta from "@/components/Cta";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";

// Live stats in the Stats band are refreshed hourly via ISR.
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AppPreview />
        <Features />
        <ThreeViews />
        <Stats />
        <Cta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
