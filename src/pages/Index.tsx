import { AudioAnalyzer } from "@/components/AudioAnalyzer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <header className="text-center mb-12">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-waveform via-waveform-secondary to-frequency bg-clip-text text-transparent mb-4">
            Advanced WAV Analyzer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Revolutionary audio analysis with precise frequency extraction, harmonic detection, and intelligent code generation
          </p>
        </header>
        
        <AudioAnalyzer />
      </div>
    </div>
  );
};

export default Index;