import React, { useState, useRef } from 'react';
import { Layers, ShieldCheck, RefreshCw, AlertTriangle, HelpCircle, X, Camera } from 'lucide-react';
import { parseGeoglyphSVG } from '../lib/geoglyph-io';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeGeogaddiImage } from '../services/visionService';

interface GeogaddiScannerProps {
  onScanSuccess: (payload: string, fileName: string, requiresCartridge: boolean) => void;
}

const GeogaddiScanner: React.FC<GeogaddiScannerProps> = ({ onScanSuccess }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error' | 'success'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const startProgressSimulation = () => {
    setScanProgress(0);
    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 99) return 99;
        // Faster initial progress, then slow down
        const increment = prev < 80 ? (Math.random() * 5 + 2) : (Math.random() * 0.4 + 0.1);
        return parseFloat((prev + increment).toFixed(1));
      });
    }, 100);
  };

  const stopProgressSimulation = (success: boolean) => {
    if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }
    if (success) setScanProgress(100);
  };

  const processFile = async (file: File) => {
    setStatus('scanning');
    setErrorMsg('');
    setScanProgress(0);

    try {
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const text = await file.text();
        const { payload, requiresCartridge } = parseGeoglyphSVG(text);
        
        if (payload) {
          setStatus('success');
          onScanSuccess(payload, file.name, requiresCartridge);
        } else {
          throw new Error('NO GEOGADDI DATA STREAM FOUND IN SVG METADATA.');
        }
      } else if (file.type.startsWith('image/')) {
        // --- NEW: Analog Intake Protocol (Vision AI) ---
        startProgressSimulation();
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64 = (e.target?.result as string).split(',')[1];
                const responseStr = await analyzeGeogaddiImage(base64);
                let result;
                try {
                    result = JSON.parse(responseStr);
                } catch(e) {
                    throw new Error("GEOGADDI_VISION_ERROR: INVALID_RESPONSE_FORMAT");
                }
                
                if (result.payload && !result.error) {
                    stopProgressSimulation(true);
                    setStatus('success');
                    onScanSuccess(result.payload, `ANALOG_${file.name}`, !!result.requiresCartridge);
                } else {
                    stopProgressSimulation(false);
                    throw new Error(result.error || 'VISION ANALYSIS FAILED TO RECONSTRUCT DATA.');
                }
            } catch (err: any) {
                stopProgressSimulation(false);
                setStatus('error');
                setErrorMsg(err.message || 'CV-SIGMA OFFLINE.');
            }
        };
        reader.readAsDataURL(file);
      } else {
        throw new Error('UNSUPPORTED FORMAT. PLEASE PROVIDE SVG OR ANALOG SCREENSHOT.');
      }
    } catch (err: any) {
      stopProgressSimulation(false);
      setStatus('error');
      setErrorMsg(err.message || 'SCAN FAILURE.');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-phi-3)] relative">
      <div className="absolute -top-6 right-0">
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-white/20 hover:text-royal-blue transition-colors flex items-center gap-1.5"
        >
          <span className="text-[9px] font-mono uppercase tracking-tighter">Scanner Help</span>
          <HelpCircle size={10} />
        </button>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-0 left-0 right-0 z-50 bg-black/95 border border-royal-blue/30 p-4 shadow-2xl rounded-sm"
          >
             <div className="flex justify-between items-center mb-3">
                <span className="text-royal-blue font-mono font-bold uppercase text-[10px] tracking-widest">Spectral Scan Protocol</span>
                <button onClick={() => setShowInfo(false)} className="text-white/40 hover:text-white"><X size={14}/></button>
             </div>
             <p className="text-[10px] font-mono text-white/70 leading-relaxed">
               Drop an SVG fingerprint file OR a high-resolution PNG/JPG screenshot. 
               The scanner extracts the <span className="text-royal-blue">Hidden Metadata</span> (SVG) or performs <span className="text-telemetry-green">CV-SIGMA Optical Analysis</span> (Analog) to reconstruct the payload.
             </p>
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".svg,.png,.jpg,.jpeg"
        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
      />
      
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={onDrop}
        className={`p-[var(--spacing-phi-4)] border-2 border-dashed flex flex-col items-center justify-center text-center gap-[var(--spacing-phi-2)] group transition-all cursor-pointer ${
          isHovering 
            ? 'border-telemetry-green bg-telemetry-green/5' 
            : status === 'success' 
              ? 'border-royal-blue bg-royal-blue/5' 
              : status === 'error'
                ? 'border-caution-red bg-caution-red/5'
                : 'border-instrument-blue/50 hover:border-royal-blue'
        }`}
      >
        <div className={`p-[var(--spacing-phi-2)] rounded-full transition-colors relative ${
          status === 'success' 
            ? 'bg-royal-blue text-white shadow-[0_0_15px_rgba(0,102,255,0.4)]' 
            : status === 'error'
              ? 'bg-caution-red text-white'
              : 'bg-instrument-blue/30 text-white/40 group-hover:text-royal-blue'
        }`}>
          {status === 'scanning' ? (
            <div className="relative flex items-center justify-center">
              <RefreshCw className="animate-spin" size={34} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-mono font-bold text-white tracking-widest">{Math.floor(scanProgress)}%</span>
              </div>
            </div>
          ) : 
           status === 'success' ? <ShieldCheck size={34} /> : 
           status === 'error' ? <AlertTriangle size={34} /> :
           status === 'idle' && isHovering ? <Camera size={34} /> :
           <Layers size={34} />}
        </div>
        <div>
          <h3 className={`text-xs font-mono uppercase transition-colors ${
            status === 'success' ? 'text-white' : 'text-white/60 group-hover:text-white'
          }`}>
            {status === 'scanning' ? (
              <div className="flex flex-col gap-1">
                <span>ANALOG/SPECTRAL SCAN IN PROGRESS...</span>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${scanProgress}%` }}
                    className="h-full bg-telemetry-green"
                  />
                </div>
              </div>
            ) :
             status === 'success' ? 'DATA STREAM RECONSTRUCTED' :
             status === 'error' ? 'RECOVERY FAILED' :
             'Import Fingerprint (SVG/PNG)'}
          </h3>
          <p className="text-[10px] font-mono text-white/20 mt-1 uppercase">
            {status === 'error' ? errorMsg : 'Drop Vector or Analog Screenshot to recover entropy'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeogaddiScanner;
