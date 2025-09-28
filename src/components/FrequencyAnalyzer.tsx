import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AnalysisResult } from "@/lib/audioProcessor";

interface FrequencyAnalyzerProps {
  analysisResult: AnalysisResult;
}

export const FrequencyAnalyzer = ({ analysisResult }: FrequencyAnalyzerProps) => {
  const { spectralFeatures, harmonics, fundamentalFreq, spectralCentroid, spectralRolloff } = analysisResult;

  // Get note name from frequency
  const getNoteName = (frequency: number): string => {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    if (frequency <= 0) return "N/A";
    
    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const n = h % 12;
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    return `${notes[n]}${octave}`;
  };

  // Calculate cents deviation from nearest semitone
  const getCentsDeviation = (frequency: number): number => {
    if (frequency <= 0) return 0;
    
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    const h = 12 * Math.log2(frequency / C0);
    const nearestSemitone = Math.round(h);
    const cents = (h - nearestSemitone) * 100;
    
    return Math.round(cents);
  };

  return (
    <div className="space-y-6">
      {/* Key Frequency Information */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Key Frequency Analysis</h3>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Fundamental Frequency</div>
              <div className="text-2xl font-bold text-primary">
                {fundamentalFreq ? fundamentalFreq.toFixed(2) : 'N/A'} Hz
              </div>
              {fundamentalFreq && (
                <div className="text-sm text-muted-foreground">
                  {getNoteName(fundamentalFreq)} ({getCentsDeviation(fundamentalFreq)} cents)
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-1">Spectral Centroid</div>
              <div className="text-lg font-semibold">
                {spectralCentroid.toFixed(2)} Hz
              </div>
              <div className="text-sm text-muted-foreground">
                Brightness measure
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Spectral Rolloff</div>
              <div className="text-lg font-semibold">
                {spectralRolloff.toFixed(2)} Hz
              </div>
              <div className="text-sm text-muted-foreground">
                85% of energy below this frequency
              </div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Harmonics</div>
              <div className="text-lg font-semibold">
                {harmonics.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Detected harmonic series
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Frequencies */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Dominant Frequencies</h3>
        
        <div className="space-y-4">
          {spectralFeatures.slice(0, 12).map((feature, index) => {
            const note = getNoteName(feature.frequency);
            const cents = getCentsDeviation(feature.frequency);
            const magnitude = feature.magnitude;
            const maxMagnitude = spectralFeatures[0]?.magnitude || 1;
            const relativeStrength = (magnitude / maxMagnitude) * 100;

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium">
                        {feature.frequency.toFixed(2)} Hz
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {note} {cents !== 0 && `(${cents > 0 ? '+' : ''}${cents} cents)`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {relativeStrength.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {magnitude.toFixed(4)}
                    </div>
                  </div>
                </div>
                <Progress 
                  value={relativeStrength} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Harmonic Series Analysis */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Harmonic Series Detail</h3>
        
        <div className="space-y-6">
          {harmonics.slice(0, 6).map((harmonic, index) => (
            <div key={index} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">
                  Series {index + 1}: {harmonic.fundamental.toFixed(2)} Hz
                </h4>
                <span className="text-sm text-muted-foreground">
                  Strength: {harmonic.strength.toFixed(3)}
                </span>
              </div>
              
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {harmonic.overtones.slice(0, 8).map((overtone, overtoneIndex) => {
                  const harmonicNumber = overtoneIndex + 1;
                  const theoreticalFreq = harmonic.fundamental * harmonicNumber;
                  const deviation = overtone.frequency - theoreticalFreq;
                  
                  return (
                    <div key={overtoneIndex} className="bg-muted rounded p-2 text-sm">
                      <div className="font-medium">
                        H{harmonicNumber}: {overtone.frequency.toFixed(1)}Hz
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {getNoteName(overtone.frequency)} • {overtone.magnitude.toFixed(3)}
                      </div>
                      {Math.abs(deviation) > 1 && (
                        <div className="text-xs text-yellow-600">
                          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}Hz
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Spectral Characteristics */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Spectral Characteristics</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Harmonic Content</div>
            <div className="text-2xl font-bold text-primary">
              {((harmonics.length / spectralFeatures.length) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              Tonal vs. noisy content
            </div>
          </div>
          
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Frequency Spread</div>
            <div className="text-2xl font-bold text-frequency">
              {(spectralRolloff / 1000).toFixed(1)}kHz
            </div>
            <div className="text-sm text-muted-foreground">
              Energy distribution
            </div>
          </div>
          
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Complexity</div>
            <div className="text-2xl font-bold text-waveform-secondary">
              {spectralFeatures.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Significant frequencies
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};