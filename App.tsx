import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Film, Video as VideoIcon, Camera, Users, Zap, Image as ImageIcon, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import AsciiBackground from './components/AsciiBackground';
import Terminal from './components/Terminal';
import Loader from './components/Loader';
import { analyzeNovel, generateShotsForBeat, generateShotImage, generateShotVideo } from './services/gemini';
import { ProcessingState, ScriptData, LogEntry, Scene, Beat, Shot } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [inputText, setInputText] = useState<string>('');
  
  // Selection State
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [processingShotId, setProcessingShotId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setInputText(text);
    addLog(`Loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, 'success');
  };

  // 1. Analyze Novel -> Get Assets & Scenes
  const startAnalysis = async () => {
    if (!inputText.trim()) return;

    try {
      setState(ProcessingState.ANALYZING_SCRIPT);
      addLog("Analyzing Structure & Scenes...", 'info');
      
      const data = await analyzeNovel(inputText);
      setScriptData(data);
      addLog(`Analysis Complete: ${data.assets.length} Assets, ${data.scenes.length} Scenes.`, 'success');
      setState(ProcessingState.COMPLETE);

    } catch (error: any) {
      addLog(`Analysis Failed: ${error.message}`, 'error');
      setState(ProcessingState.ERROR);
    }
  };

  // Toggle Scene Expansion
  const toggleScene = (sceneId: string) => {
    setScriptData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, isExpanded: !s.isExpanded } : s)
        };
    });
  };

  // 2. Breakdown Beat -> Get Shots
  const handleBeatSelect = async (scene: Scene, beat: Beat) => {
    setSelectedSceneId(scene.id);
    setSelectedBeatId(beat.id);

    // If shots already exist, just select
    if (beat.shots.length > 0) return;

    try {
        setState(ProcessingState.GENERATING_SHOTS);
        addLog(`Breaking down beat in "${scene.slugline}"...`, 'info');
        
        const shots = await generateShotsForBeat(beat, scene.slugline, scriptData?.assets || []);
        
        setScriptData(prev => {
            if(!prev) return null;
            return {
                ...prev,
                scenes: prev.scenes.map(s => {
                    if (s.id !== scene.id) return s;
                    return {
                        ...s,
                        beats: s.beats.map(b => b.id === beat.id ? { ...b, shots } : b)
                    };
                })
            };
        });
        
        addLog(`Generated ${shots.length} shots.`, 'success');
        setState(ProcessingState.COMPLETE);
    } catch (error: any) {
        addLog(`Breakdown failed: ${error.message}`, 'error');
        setState(ProcessingState.COMPLETE);
    }
  };

  // 3. Render Shot Image
  const renderShotImage = async (sceneId: string, beatId: string, shot: Shot) => {
    try {
        setProcessingShotId(shot.id);
        addLog(`Rendering storyboard for Shot ${shot.id}...`, 'info');
        
        const imageUrl = await generateShotImage(shot.visualPrompt);
        
        setScriptData(prev => {
            if(!prev) return null;
            return {
                ...prev,
                scenes: prev.scenes.map(s => {
                    if (s.id !== sceneId) return s;
                    return {
                        ...s,
                        beats: s.beats.map(b => {
                            if (b.id !== beatId) return b;
                            return {
                                ...b,
                                shots: b.shots.map(sht => sht.id === shot.id ? { ...sht, imageUrl } : sht)
                            }
                        })
                    }
                })
            };
        });
        addLog(`Shot ${shot.id} visualized.`, 'success');
    } catch (error: any) {
        addLog(`Render failed: ${error.message}`, 'error');
    } finally {
        setProcessingShotId(null);
    }
  };

  // 4. Render Shot Video
  const renderShotVideo = async (sceneId: string, beatId: string, shot: Shot) => {
    if (!shot.imageUrl) {
        addLog("Generate an image first to guide the video.", 'warning');
        return;
    }
    try {
        setProcessingShotId(shot.id);
        addLog(`Simulating video for Shot ${shot.id} (Veo)...`, 'warning');
        
        const videoUrl = await generateShotVideo(shot, shot.imageUrl);
        
        setScriptData(prev => {
            if(!prev) return null;
            return {
                ...prev,
                scenes: prev.scenes.map(s => {
                    if (s.id !== sceneId) return s;
                    return {
                        ...s,
                        beats: s.beats.map(b => {
                            if (b.id !== beatId) return b;
                            return {
                                ...b,
                                shots: b.shots.map(sht => sht.id === shot.id ? { ...sht, videoUrl } : sht)
                            }
                        })
                    }
                })
            };
        });
        addLog(`Video ready for Shot ${shot.id}.`, 'success');
    } catch (error: any) {
        addLog(`Video failed: ${error.message}`, 'error');
    } finally {
        setProcessingShotId(null);
    }
  };

  const getActiveScene = () => scriptData?.scenes.find(s => s.id === selectedSceneId);
  const getActiveBeat = () => getActiveScene()?.beats.find(b => b.id === selectedBeatId);

  return (
    <div className="relative min-h-screen text-[#F0F0F0] font-sans selection:bg-[#FF4500] selection:text-white bg-[#050505] overflow-hidden">
      <AsciiBackground />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-14 border-b border-[#333] bg-[#050505]/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
            <Film className="w-5 h-5 text-[var(--color-accent)]" />
            <h1 className="text-lg font-bold tracking-tighter font-serif">CINE-OS <span className="text-[10px] font-mono font-normal opacity-50 ml-2">PROD_PIPELINE_V4</span></h1>
        </div>
        <div className="flex items-center gap-4">
            {state !== ProcessingState.IDLE && (
                <div className="text-[10px] font-mono text-[var(--color-accent)] animate-pulse flex items-center gap-2">
                    <Zap size={12} /> PROCESSING_NODE_ACTIVE
                </div>
            )}
        </div>
      </header>

      <main className="pt-14 h-screen flex flex-col">
        
        {/* INPUT STAGE */}
        {!scriptData && (
             <div className="flex-1 flex items-center justify-center p-4">
                 <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl w-full text-center"
                >
                    <h2 className="text-4xl font-serif mb-2">Import Manuscript</h2>
                    <p className="text-gray-500 font-mono text-xs mb-8">Supported Formats: .txt, .md (Max 15k chars)</p>
                    
                    <div 
                        className="border border-dashed border-[#333] hover:border-[var(--color-accent)] bg-[#0A0A0A] p-12 rounded-lg cursor-pointer transition-colors group relative overflow-hidden"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="absolute inset-0 bg-[var(--color-accent)]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.md" onChange={handleFileUpload} />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500 group-hover:text-white transition-colors" />
                        <p className="font-mono text-sm text-gray-400 relative z-10">
                            {inputText ? "FILE LOADED. READY TO PARSE." : "DROP RAW TEXT FILE"}
                        </p>
                    </div>
                    {inputText && (
                         <button 
                            onClick={startAnalysis}
                            disabled={state === ProcessingState.ANALYZING_SCRIPT}
                            className="mt-6 w-full py-4 bg-[var(--color-accent)] text-black font-mono font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {state === ProcessingState.ANALYZING_SCRIPT ? "EXTRACTING SCENES & ASSETS..." : "INITIATE BREAKDOWN"}
                        </button>
                    )}
                </motion.div>
             </div>
        )}

        {/* WORKSPACE STAGE */}
        {scriptData && (
            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                
                {/* COL 1: ASSETS (Left Panel) */}
                <div className="col-span-2 border-r border-[#333] flex flex-col bg-[#080808]">
                    <div className="flex items-center gap-2 p-3 border-b border-[#333]">
                        <Users className="w-3 h-3 text-gray-400" />
                        <h3 className="font-mono text-[10px] text-gray-400 tracking-widest">CASTING</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar pb-20">
                        {scriptData.assets.map(asset => (
                            <div key={asset.id} className="bg-[#111] border border-[#222] p-3 rounded-sm group hover:border-gray-600 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-[11px] text-[var(--color-accent)] block leading-tight">{asset.name}</span>
                                    <span className="text-[9px] bg-[#222] px-1.5 py-0.5 rounded text-gray-400">{asset.type[0]}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-snug line-clamp-3 group-hover:line-clamp-none transition-all">
                                    {asset.visualDescription}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COL 2: SCRIPT SEQUENCES (Middle Panel) */}
                <div className="col-span-4 border-r border-[#333] flex flex-col bg-[#050505]">
                    <div className="flex items-center gap-2 p-3 border-b border-[#333]">
                        <FileText className="w-3 h-3 text-gray-400" />
                        <h3 className="font-mono text-[10px] text-gray-400 tracking-widest">SCENE LIST</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                        {scriptData.scenes.map((scene) => (
                            <div key={scene.id} className="border-b border-[#222]">
                                {/* Scene Header */}
                                <div 
                                    onClick={() => toggleScene(scene.id)}
                                    className="p-3 bg-[#0A0A0A] hover:bg-[#111] cursor-pointer flex items-center justify-between group transition-colors sticky top-0 z-10 border-b border-[#1a1a1a]"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <h4 className="font-bold text-xs text-gray-300 font-mono group-hover:text-white transition-colors">{scene.slugline}</h4>
                                        <span className="text-[9px] text-gray-600">{scene.beats.length} BEATS</span>
                                    </div>
                                    <div className={`text-gray-600 group-hover:text-white transition-transform duration-200 ${scene.isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>

                                {/* Nested Beats */}
                                <AnimatePresence>
                                    {scene.isExpanded && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-black/50"
                                        >
                                            {scene.beats.map((beat, idx) => (
                                                <div 
                                                    key={beat.id}
                                                    onClick={() => handleBeatSelect(scene, beat)}
                                                    className={`p-3 pl-6 border-l-2 cursor-pointer transition-all flex gap-3 ${
                                                        selectedBeatId === beat.id 
                                                        ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]' 
                                                        : 'border-transparent hover:bg-white/5 hover:border-gray-700'
                                                    }`}
                                                >
                                                    <span className="font-mono text-[9px] text-gray-600 mt-0.5 opacity-50">{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <p className={`text-[11px] leading-relaxed ${selectedBeatId === beat.id ? 'text-white' : 'text-gray-400'}`}>
                                                            {beat.description}
                                                        </p>
                                                        {beat.shots.length > 0 && (
                                                            <div className="mt-1.5 flex items-center gap-1">
                                                                <Camera size={10} className="text-[var(--color-accent)]" />
                                                                <span className="text-[9px] text-[var(--color-accent)]">{beat.shots.length} SHOTS READY</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <ChevronRight size={12} className={`mt-1 ${selectedBeatId === beat.id ? 'text-[var(--color-accent)]' : 'text-transparent'}`} />
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COL 3: SHOT EDITOR (Right Panel) */}
                <div className="col-span-6 flex flex-col bg-[#080808]">
                    <div className="flex items-center justify-between p-3 border-b border-[#333]">
                        <div className="flex items-center gap-2">
                            <Camera className="w-3 h-3 text-gray-400" />
                            <h3 className="font-mono text-[10px] text-gray-400 tracking-widest truncate max-w-[300px]">
                                {getActiveScene() ? `SHOTS: ${getActiveScene()?.slugline}` : 'SELECT A BEAT'}
                            </h3>
                        </div>
                        {state === ProcessingState.GENERATING_SHOTS && (
                             <span className="text-[9px] font-mono animate-pulse text-[var(--color-accent)]">GENERATING SHOT LIST...</span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">
                        {getActiveBeat()?.shots.map((shot) => (
                            <div key={shot.id} className="bg-[#0A0A0A] border border-[#222] p-4 flex gap-5 group hover:border-[#444] transition-colors rounded-sm">
                                
                                {/* Visual Preview Box */}
                                <div className="w-56 aspect-video bg-black shrink-0 relative border border-[#333] flex items-center justify-center overflow-hidden">
                                    {shot.videoUrl ? (
                                        <video src={shot.videoUrl} className="w-full h-full object-cover" controls loop muted autoPlay />
                                    ) : shot.imageUrl ? (
                                        <>
                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                                <button 
                                                    onClick={() => renderShotVideo(selectedSceneId!, selectedBeatId!, shot)}
                                                    className="flex flex-col items-center gap-2 transform hover:scale-105 transition-transform"
                                                >
                                                    <div className="p-3 bg-[var(--color-accent)] rounded-full text-black">
                                                        <VideoIcon className="w-5 h-5 fill-current" />
                                                    </div>
                                                    <span className="font-mono text-[9px] font-bold tracking-widest">MOTION</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0F0F0F]">
                                            {processingShotId === shot.id ? (
                                                <Loader text="RENDERING" />
                                            ) : (
                                                <button 
                                                    onClick={() => renderShotImage(selectedSceneId!, selectedBeatId!, shot)}
                                                    className="flex flex-col items-center gap-2 group/btn"
                                                >
                                                    <ImageIcon className="w-6 h-6 text-gray-600 group-hover/btn:text-white transition-colors" />
                                                    <span className="text-[9px] font-mono text-gray-600 group-hover/btn:text-white">GENERATE FRAME</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="absolute top-0 left-0 bg-black/60 backdrop-blur px-2 py-0.5 text-[9px] font-mono border-r border-b border-white/10 text-white/80">
                                        {shot.shotType.toUpperCase()}
                                    </div>
                                </div>

                                {/* Shot Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {shot.assetIds.map(aid => (
                                            <span key={aid} className="text-[9px] px-1.5 py-0.5 border border-[#333] rounded-sm text-gray-400 bg-[#111]">
                                                {scriptData?.assets.find(a => a.id === aid)?.name || aid}
                                            </span>
                                        ))}
                                    </div>
                                    <h5 className="text-sm font-serif text-gray-200 mb-2 leading-relaxed">{shot.action}</h5>
                                    <div className="bg-[#111] p-2 rounded border border-[#222] relative">
                                        <p className="text-[10px] font-mono text-gray-500 leading-relaxed break-words">{shot.visualPrompt}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {!selectedBeatId && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 font-mono text-xs gap-2 opacity-50">
                                <Film size={32} />
                                SELECT A BEAT FROM THE SCRIPT
                            </div>
                        )}

                        {selectedBeatId && getActiveBeat()?.shots.length === 0 && state !== ProcessingState.GENERATING_SHOTS && (
                             <div className="h-full flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-4 p-12 border border-dashed border-[#222]">
                                <Zap className="w-8 h-8 opacity-20" />
                                <p>NO SHOTS GENERATED YET</p>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Console / Terminal Overlay - Replaced with Bottom Bar */}
        <Terminal logs={logs} />

      </main>
    </div>
  );
};

export default App;