// Advanced Audio Processing Library
// Sophisticated frequency analysis and harmonic detection

export interface SpectralFeature {
  frequency: number;
  magnitude: number;
  phase: number;
  bandwidth: number;
}

export interface HarmonicSeries {
  fundamental: number;
  overtones: SpectralFeature[];
  strength: number;
  inharmonicity: number;
}

export interface AnalysisSettings {
  fftSize: number;
  windowSize: number;
  hopSize: number;
  minFreq: number;
  maxFreq: number;
  harmonicThreshold: number;
  noiseFloor: number;
}

export interface AnalysisResult {
  spectralFeatures: SpectralFeature[];
  harmonics: HarmonicSeries[];
  fundamentalFreq: number | null;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlux: number;
  rmsLevel: number;
  peakLevel: number;
  sampleRate: number;
  duration: number;
  envelope: Float32Array | null;
  spectrogram: number[][] | null;
}

export class AudioProcessor {
  private audioBuffer: AudioBuffer;
  private settings: AnalysisSettings;
  private windowFunction: Float32Array;

  constructor(audioBuffer: AudioBuffer, settings: AnalysisSettings) {
    this.audioBuffer = audioBuffer;
    this.settings = settings;
    this.windowFunction = this.createWindow(settings.windowSize);
  }

  private createWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      // Blackman-Harris window for excellent spectral properties
      const a0 = 0.35875;
      const a1 = 0.48829;
      const a2 = 0.14128;
      const a3 = 0.01168;
      
      window[i] = a0 - 
                  a1 * Math.cos(2 * Math.PI * i / (size - 1)) +
                  a2 * Math.cos(4 * Math.PI * i / (size - 1)) -
                  a3 * Math.cos(6 * Math.PI * i / (size - 1));
    }
    return window;
  }

  private fft(signal: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = signal.length;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    
    // Copy input signal
    for (let i = 0; i < N; i++) {
      real[i] = signal[i];
      imag[i] = 0;
    }
    
    // Bit-reversal permutation
    let j = 0;
    for (let i = 1; i < N; i++) {
      let bit = N >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    
    // Cooley-Tukey FFT
    for (let len = 2; len <= N; len *= 2) {
      const wlen = 2 * Math.PI / len;
      for (let i = 0; i < N; i += len) {
        for (let j = 0; j < len / 2; j++) {
          const u = real[i + j];
          const v = imag[i + j];
          const wr = Math.cos(wlen * j);
          const wi = Math.sin(wlen * j);
          const x = real[i + j + len / 2];
          const y = imag[i + j + len / 2];
          
          real[i + j] = u + (wr * x - wi * y);
          imag[i + j] = v + (wi * x + wr * y);
          real[i + j + len / 2] = u - (wr * x - wi * y);
          imag[i + j + len / 2] = v - (wi * x + wr * y);
        }
      }
    }
    
    return { real, imag };
  }

  private getMagnitudeSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
    const magnitude = new Float32Array(real.length / 2);
    for (let i = 0; i < magnitude.length; i++) {
      magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    return magnitude;
  }

  private getPhaseSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
    const phase = new Float32Array(real.length / 2);
    for (let i = 0; i < phase.length; i++) {
      phase[i] = Math.atan2(imag[i], real[i]);
    }
    return phase;
  }

  private findPeaks(spectrum: Float32Array, sampleRate: number): SpectralFeature[] {
    const features: SpectralFeature[] = [];
    const threshold = Math.max(...spectrum) * this.settings.harmonicThreshold;
    const freqResolution = sampleRate / (spectrum.length * 2);
    
    for (let i = 2; i < spectrum.length - 2; i++) {
      const magnitude = spectrum[i];
      
      // Peak detection with quadratic interpolation
      if (magnitude > threshold &&
          magnitude > spectrum[i - 1] &&
          magnitude > spectrum[i + 1] &&
          magnitude > spectrum[i - 2] &&
          magnitude > spectrum[i + 2]) {
        
        // Quadratic interpolation for sub-bin accuracy
        const y1 = spectrum[i - 1];
        const y2 = spectrum[i];
        const y3 = spectrum[i + 1];
        
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;
        
        let peakOffset = 0;
        if (a !== 0) {
          peakOffset = -b / (2 * a);
          peakOffset = Math.max(-1, Math.min(1, peakOffset));
        }
        
        const frequency = (i + peakOffset) * freqResolution;
        
        if (frequency >= this.settings.minFreq && frequency <= this.settings.maxFreq) {
          // Estimate bandwidth
          let bandwidth = freqResolution;
          for (let j = 1; j < 20; j++) {
            if (i - j >= 0 && spectrum[i - j] < magnitude * 0.707) {
              bandwidth = j * freqResolution;
              break;
            }
          }
          
          features.push({
            frequency,
            magnitude,
            phase: 0, // Will be calculated later if needed
            bandwidth
          });
        }
      }
    }
    
    // Sort by magnitude (highest first)
    features.sort((a, b) => b.magnitude - a.magnitude);
    return features;
  }

  private detectHarmonics(features: SpectralFeature[]): HarmonicSeries[] {
    const harmonics: HarmonicSeries[] = [];
    const processed = new Set<number>();
    
    // Group features by potential fundamental relationships
    for (let i = 0; i < Math.min(features.length, 50); i++) {
      if (processed.has(i)) continue;
      
      const fundamental = features[i];
      const series: SpectralFeature[] = [fundamental];
      processed.add(i);
      
      // Look for harmonic relationships
      for (let harmonicNum = 2; harmonicNum <= 20; harmonicNum++) {
        const targetFreq = fundamental.frequency * harmonicNum;
        let bestMatch: { feature: SpectralFeature; index: number } | null = null;
        let minError = Infinity;
        
        for (let j = i + 1; j < features.length; j++) {
          if (processed.has(j)) continue;
          
          const feature = features[j];
          const error = Math.abs(feature.frequency - targetFreq) / targetFreq;
          
          if (error < 0.02 && error < minError) { // 2% tolerance
            minError = error;
            bestMatch = { feature, index: j };
          }
        }
        
        if (bestMatch) {
          series.push(bestMatch.feature);
          processed.add(bestMatch.index);
        }
      }
      
      // Only keep series with at least 3 harmonics
      if (series.length >= 3) {
        // Calculate inharmonicity
        let inharmonicity = 0;
        for (let k = 1; k < series.length; k++) {
          const expected = fundamental.frequency * (k + 1);
          const actual = series[k].frequency;
          inharmonicity += Math.abs(actual - expected) / expected;
        }
        inharmonicity /= (series.length - 1);
        
        // Calculate series strength
        const strength = series.reduce((sum, s) => sum + s.magnitude, 0);
        
        harmonics.push({
          fundamental: fundamental.frequency,
          overtones: series,
          strength,
          inharmonicity
        });
      }
    }
    
    // Sort by strength
    harmonics.sort((a, b) => b.strength - a.strength);
    return harmonics;
  }

  private calculateSpectralCentroid(spectrum: Float32Array, sampleRate: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    const freqResolution = sampleRate / (spectrum.length * 2);
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * freqResolution;
      const magnitude = spectrum[i];
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(spectrum: Float32Array, sampleRate: number): number {
    const freqResolution = sampleRate / (spectrum.length * 2);
    const totalEnergy = spectrum.reduce((sum, mag) => sum + mag * mag, 0);
    const threshold = totalEnergy * 0.85; // 85% rolloff
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= threshold) {
        return i * freqResolution;
      }
    }
    
    return (spectrum.length - 1) * freqResolution;
  }

  private calculateEnvelope(audioData: Float32Array): Float32Array {
    const envelope = new Float32Array(audioData.length);
    const windowSize = Math.floor(this.audioBuffer.sampleRate * 0.01); // 10ms window
    
    for (let i = 0; i < audioData.length; i++) {
      let sum = 0;
      let count = 0;
      
      const start = Math.max(0, i - windowSize / 2);
      const end = Math.min(audioData.length, i + windowSize / 2);
      
      for (let j = start; j < end; j++) {
        sum += Math.abs(audioData[j]);
        count++;
      }
      
      envelope[i] = count > 0 ? sum / count : 0;
    }
    
    return envelope;
  }

  private generateSpectrogram(audioData: Float32Array): number[][] {
    const hopSize = this.settings.hopSize;
    const windowSize = this.settings.windowSize;
    const numFrames = Math.floor((audioData.length - windowSize) / hopSize) + 1;
    const numBins = windowSize / 2;
    
    const spectrogram: number[][] = [];
    
    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize;
      const windowedFrame = new Float32Array(windowSize);
      
      // Apply window function
      for (let i = 0; i < windowSize; i++) {
        if (start + i < audioData.length) {
          windowedFrame[i] = audioData[start + i] * this.windowFunction[i];
        }
      }
      
      // Perform FFT
      const { real, imag } = this.fft(windowedFrame);
      const magnitude = this.getMagnitudeSpectrum(real, imag);
      
      // Convert to dB and normalize
      const magnitudeDB = new Array(numBins);
      for (let i = 0; i < numBins; i++) {
        const db = 20 * Math.log10(Math.max(magnitude[i], 1e-10));
        magnitudeDB[i] = Math.max(0, (db + 100) / 100); // Normalize to 0-1
      }
      
      spectrogram.push(magnitudeDB);
    }
    
    return spectrogram;
  }

  async analyze(): Promise<AnalysisResult> {
    // Get audio data (convert to mono if stereo)
    let audioData: Float32Array;
    if (this.audioBuffer.numberOfChannels === 1) {
      audioData = this.audioBuffer.getChannelData(0);
    } else {
      // Mix down to mono
      const left = this.audioBuffer.getChannelData(0);
      const right = this.audioBuffer.numberOfChannels > 1 ? 
                    this.audioBuffer.getChannelData(1) : left;
      
      audioData = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        audioData[i] = (left[i] + right[i]) / 2;
      }
    }

    // Calculate RMS and peak levels
    let rmsSum = 0;
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.abs(audioData[i]);
      rmsSum += sample * sample;
      peak = Math.max(peak, sample);
    }
    const rmsLevel = Math.sqrt(rmsSum / audioData.length);

    // Perform windowed FFT on entire signal
    const windowSize = this.settings.fftSize;
    const windowedSignal = new Float32Array(windowSize);
    
    // Take the middle section of the audio for analysis
    const start = Math.floor((audioData.length - windowSize) / 2);
    for (let i = 0; i < windowSize; i++) {
      if (start + i < audioData.length && start + i >= 0) {
        windowedSignal[i] = audioData[start + i] * this.windowFunction[i];
      }
    }

    // Perform FFT
    const { real, imag } = this.fft(windowedSignal);
    const magnitude = this.getMagnitudeSpectrum(real, imag);
    
    // Find spectral features
    const spectralFeatures = this.findPeaks(magnitude, this.audioBuffer.sampleRate);
    
    // Detect harmonic series
    const harmonics = this.detectHarmonics(spectralFeatures);
    
    // Calculate spectral characteristics
    const spectralCentroid = this.calculateSpectralCentroid(magnitude, this.audioBuffer.sampleRate);
    const spectralRolloff = this.calculateSpectralRolloff(magnitude, this.audioBuffer.sampleRate);
    
    // Find fundamental frequency (strongest harmonic series or lowest significant peak)
    let fundamentalFreq: number | null = null;
    if (harmonics.length > 0) {
      fundamentalFreq = harmonics[0].fundamental;
    } else if (spectralFeatures.length > 0) {
      // Find the lowest frequency peak above minimum threshold
      for (const feature of spectralFeatures.slice().reverse()) {
        if (feature.frequency >= this.settings.minFreq) {
          fundamentalFreq = feature.frequency;
        }
      }
    }
    
    // Calculate envelope
    const envelope = this.calculateEnvelope(audioData);
    
    // Generate spectrogram
    const spectrogram = this.generateSpectrogram(audioData);
    
    return {
      spectralFeatures,
      harmonics,
      fundamentalFreq,
      spectralCentroid,
      spectralRolloff,
      spectralFlux: 0, // Would require temporal analysis
      rmsLevel,
      peakLevel: peak,
      sampleRate: this.audioBuffer.sampleRate,
      duration: this.audioBuffer.duration,
      envelope,
      spectrogram
    };
  }
}
