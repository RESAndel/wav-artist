import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { AnalysisResult } from "@/lib/audioProcessor";

interface WaveformVisualizerProps {
  audioBuffer: AudioBuffer;
  analysisResult: AnalysisResult;
}

export const WaveformVisualizer = ({ audioBuffer, analysisResult }: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [offsetX, setOffsetX] = useState(0);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = 'hsl(var(--background))';
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / width * zoomLevel);
    const startSample = Math.floor(offsetX * channelData.length);

    // Draw waveform
    ctx.strokeStyle = 'hsl(var(--waveform))';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + x * samplesPerPixel;
      if (sampleIndex >= channelData.length) break;

      let min = 0;
      let max = 0;

      // Find min and max in this pixel's sample range
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }

      const y1 = ((min + 1) * height) / 2;
      const y2 = ((max + 1) * height) / 2;

      if (x === 0) {
        ctx.moveTo(x, y1);
      } else {
        ctx.lineTo(x, y1);
      }
      
      if (Math.abs(y2 - y1) > 1) {
        ctx.lineTo(x, y2);
      }
    }

    ctx.stroke();

    // Draw envelope
    if (analysisResult.envelope) {
      ctx.strokeStyle = 'hsl(var(--waveform-secondary))';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();

      const envelopeLength = analysisResult.envelope.length;
      const envelopeSamplesPerPixel = envelopeLength / width;

      for (let x = 0; x < width; x++) {
        const envelopeIndex = Math.floor(x * envelopeSamplesPerPixel);
        if (envelopeIndex >= envelopeLength) break;

        const envelopeValue = analysisResult.envelope[envelopeIndex];
        const y = height / 2 - (envelopeValue * height) / 4;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw time markers
    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.font = '12px monospace';
    const duration = audioBuffer.duration;
    const timeStep = duration / 10;

    for (let i = 0; i <= 10; i++) {
      const time = i * timeStep;
      const x = (i / 10) * width;
      const timeStr = time.toFixed(1) + 's';
      
      ctx.fillText(timeStr, x - 15, height - 5);
      
      ctx.strokeStyle = 'hsl(var(--border))';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  };

  const drawSpectrogram = () => {
    const canvas = spectrogramRef.current;
    if (!canvas || !analysisResult.spectrogram) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const spectrogram = analysisResult.spectrogram;

    // Clear canvas
    ctx.fillStyle = 'hsl(var(--background))';
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const specX = Math.floor((x / width) * spectrogram.length);
        const specY = Math.floor(((height - y) / height) * spectrogram[0].length);
        
        if (specX < spectrogram.length && specY < spectrogram[0].length) {
          const magnitude = spectrogram[specX][specY];
          const intensity = Math.min(255, Math.max(0, magnitude * 255));
          
          const index = (y * width + x) * 4;
          
          // Create a nice color gradient based on intensity
          const hue = 200 + (intensity / 255) * 100; // Blue to cyan
          const sat = 80;
          const light = intensity / 255 * 60 + 10;
          
          const [r, g, b] = hslToRgb(hue / 360, sat / 100, light / 100);
          
          data[index] = r;     // R
          data[index + 1] = g; // G  
          data[index + 2] = b; // B
          data[index + 3] = 255; // A
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw frequency labels
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.font = '11px monospace';
    const maxFreq = analysisResult.sampleRate / 2;
    
    for (let i = 0; i <= 10; i++) {
      const freq = (i / 10) * maxFreq;
      const y = height - (i / 10) * height;
      const freqStr = freq >= 1000 ? `${(freq/1000).toFixed(1)}k` : `${freq.toFixed(0)}`;
      
      ctx.fillText(freqStr, 5, y + 4);
    }
  };

  // Helper function to convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  useEffect(() => {
    drawWaveform();
  }, [audioBuffer, analysisResult, zoomLevel, offsetX]);

  useEffect(() => {
    drawSpectrogram();
  }, [analysisResult]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 0.1));
  const handleReset = () => {
    setZoomLevel(1);
    setOffsetX(0);
  };

  return (
    <div className="space-y-6">
      {/* Waveform Display */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Waveform Analysis</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="bg-muted rounded-lg p-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full h-auto bg-background rounded border"
            style={{ maxWidth: '100%' }}
          />
        </div>
        
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground">Duration</div>
            <div className="font-semibold">{audioBuffer.duration.toFixed(2)}s</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Sample Rate</div>
            <div className="font-semibold">{audioBuffer.sampleRate}Hz</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">RMS Level</div>
            <div className="font-semibold">{(analysisResult.rmsLevel * 100).toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Peak Level</div>
            <div className="font-semibold">{(analysisResult.peakLevel * 100).toFixed(1)}%</div>
          </div>
        </div>
      </Card>

      {/* Spectrogram */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Spectrogram</h3>
        <div className="bg-muted rounded-lg p-4">
          <canvas
            ref={spectrogramRef}
            width={800}
            height={300}
            className="w-full h-auto bg-background rounded border"
            style={{ maxWidth: '100%' }}
          />
        </div>
        <div className="mt-2 text-sm text-muted-foreground text-center">
          Time (horizontal) × Frequency (vertical) × Magnitude (color intensity)
        </div>
      </Card>
    </div>
  );
};