import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Play, Pause, Download, Settings, Activity } from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { FrequencyAnalyzer } from "./FrequencyAnalyzer";
import { CodeGenerator } from "./CodeGenerator";
import { AudioProcessor, type AnalysisResult } from "@/lib/audioProcessor";
import { useToast } from "@/hooks/use-toast";

export const AudioAnalyzer = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [analysisSettings, setAnalysisSettings] = useState({
    fftSize: 8192,
    windowSize: 2048,
    hopSize: 512,
    minFreq: 20,
    maxFreq: 20000,
    harmonicThreshold: 0.1,
    noiseFloor: -60
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const { toast } = useToast();

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an audio file (.wav, .mp3, .m4a, etc.)",
        variant: "destructive"
      });
      return;
    }

    setAudioFile(file);
    setIsAnalyzing(true);

    try {
      const audioContext = initAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      setAudioBuffer(audioBuffer);
      
      // Perform advanced analysis
      const processor = new AudioProcessor(audioBuffer, analysisSettings);
      const result = await processor.analyze();
      
      setAnalysisResult(result);
      
      toast({
        title: "Analysis complete!",
        description: `Found ${result.harmonics.length} harmonic series and ${result.spectralFeatures.length} key frequencies`
      });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Analysis failed",
        description: "Could not analyze the audio file. Please try a different file.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [analysisSettings, initAudioContext, toast]);

  const playAudio = useCallback(() => {
    if (!audioBuffer) return;

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    const audioContext = initAudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    source.onended = () => setIsPlaying(false);
    sourceNodeRef.current = source;
    
    source.start();
    setIsPlaying(true);
  }, [audioBuffer, isPlaying, initAudioContext]);

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* File Upload Section */}
      <Card className="p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Upload className="w-12 h-12 text-primary" />
          </div>
          
          <div>
            <h3 className="text-2xl font-semibold mb-2">Upload Audio File</h3>
            <p className="text-muted-foreground mb-6">
              Drop your WAV, MP3, or other audio file for advanced harmonic analysis
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={triggerFileInput}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="w-5 h-5 mr-2" />
              Choose File
            </Button>
            
            {audioBuffer && (
              <Button 
                onClick={playAudio}
                variant="outline"
                size="lg"
              >
                {isPlaying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {audioFile && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>File:</strong> {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
              {audioBuffer && (
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Duration:</strong> {audioBuffer.duration.toFixed(2)}s • 
                  <strong> Sample Rate:</strong> {audioBuffer.sampleRate}Hz •
                  <strong> Channels:</strong> {audioBuffer.numberOfChannels}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Loading */}
      {isAnalyzing && (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
            </div>
            <h3 className="text-xl font-semibold">Analyzing Audio...</h3>
            <p className="text-muted-foreground">
              Performing advanced frequency analysis, harmonic detection, and spectral processing
            </p>
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisResult && audioBuffer && (
        <Tabs defaultValue="waveform" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="waveform" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Waveform
            </TabsTrigger>
            <TabsTrigger value="frequency">Frequency Analysis</TabsTrigger>
            <TabsTrigger value="harmonics">Harmonic Series</TabsTrigger>
            <TabsTrigger value="code">Generated Code</TabsTrigger>
          </TabsList>

          <TabsContent value="waveform" className="space-y-6">
            <WaveformVisualizer 
              audioBuffer={audioBuffer} 
              analysisResult={analysisResult} 
            />
          </TabsContent>

          <TabsContent value="frequency" className="space-y-6">
            <FrequencyAnalyzer 
              analysisResult={analysisResult} 
            />
          </TabsContent>

          <TabsContent value="harmonics" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Detected Harmonic Series</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {analysisResult.harmonics.map((harmonic, index) => (
                  <div key={index} className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Series {index + 1}</span>
                      <span className="text-xs text-muted-foreground">
                        {harmonic.strength.toFixed(3)} strength
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <strong>Fundamental:</strong> {harmonic.fundamental.toFixed(1)}Hz
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {harmonic.overtones.length} overtones detected
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="space-y-6">
            <CodeGenerator 
              analysisResult={analysisResult} 
              audioBuffer={audioBuffer}
              fileName={audioFile?.name || 'audio'} 
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Analysis Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Analysis Settings</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="fftSize">FFT Size</Label>
            <Input
              id="fftSize"
              type="number"
              value={analysisSettings.fftSize}
              onChange={(e) => setAnalysisSettings(prev => ({
                ...prev,
                fftSize: parseInt(e.target.value)
              }))}
              min="1024"
              max="16384"
              step="1024"
            />
          </div>
          
          <div>
            <Label htmlFor="harmonicThreshold">Harmonic Threshold</Label>
            <Input
              id="harmonicThreshold"
              type="number"
              value={analysisSettings.harmonicThreshold}
              onChange={(e) => setAnalysisSettings(prev => ({
                ...prev,
                harmonicThreshold: parseFloat(e.target.value)
              }))}
              min="0.01"
              max="1"
              step="0.01"
            />
          </div>
          
          <div>
            <Label htmlFor="minFreq">Min Frequency (Hz)</Label>
            <Input
              id="minFreq"
              type="number"
              value={analysisSettings.minFreq}
              onChange={(e) => setAnalysisSettings(prev => ({
                ...prev,
                minFreq: parseInt(e.target.value)
              }))}
              min="1"
              max="1000"
            />
          </div>
          
          <div>
            <Label htmlFor="maxFreq">Max Frequency (Hz)</Label>
            <Input
              id="maxFreq"
              type="number"
              value={analysisSettings.maxFreq}
              onChange={(e) => setAnalysisSettings(prev => ({
                ...prev,
                maxFreq: parseInt(e.target.value)
              }))}
              min="1000"
              max="48000"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};