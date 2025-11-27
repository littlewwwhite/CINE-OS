import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Film, Video as VideoIcon, Camera, Users, Zap, Image as ImageIcon, ChevronDown, ChevronRight, FileText, ArrowRight, Book, FileType, Play } from 'lucide-react';
import AsciiBackground from './components/AsciiBackground';
import Terminal from './components/Terminal';
import Loader from './components/Loader';
import { analyzeNovel, generateShotsForBeat, generateShotImage, generateShotVideo } from './services/gemini';
import { ProcessingState, ScriptData, LogEntry, Scene, Beat, Shot } from './types';

type ViewState = 'LANDING' | 'IMPORT' | 'WORKSPACE';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  
  // Selection State
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [processingShotId, setProcessingShotId] = useState<string | null>(null);
  
  // File Input Refs
  const novelInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Handle File Upload and Auto-Start
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'NOVEL' | 'SCRIPT') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    addLog(`System Input: ${file.name} (${mode} MODE)`, 'info');
    const text = await file.text();
    
    await startAnalysis(text, mode);
  };

  // 1. Analyze Logic
  const startAnalysis = async (text: string, mode: 'NOVEL' | 'SCRIPT') => {
    try {
      setState(ProcessingState.ANALYZING_SCRIPT);
      // Immediately switch to workspace to show loading state there, or keep a loading overlay
      setView('WORKSPACE'); 
      addLog(`Initializing ${mode} Pipeline...`, 'info');
      addLog("Extracting Narrative Structure & Assets...", 'info');
      
      const data = await analyzeNovel(text, mode);
      setScriptData(data);
      addLog(`Analysis Complete: ${data.assets.length} Assets, ${data.scenes.length} Scenes parsed.`, 'success');
      setState(ProcessingState.COMPLETE);

    } catch (error: any) {
      addLog(`CRITICAL FAILURE: ${error.message}`, 'error');
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
        addLog(`Analyzing beat context: ${scene.slugline}`, 'info');
        
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
        addLog(`Shot Gen Error: ${error.message}`, 'error');
        setState(ProcessingState.COMPLETE);
    }
  };

  // 3. Render Shot Image
  const renderShotImage = async (sceneId: string, beatId: string, shot: Shot) => {
    try {
        setProcessingShotId(shot.id);
        addLog(`Rendering Asset: ${shot.id}`, 'info');
        
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
        addLog(`Frame Rendered: ${shot.id}`, 'success');
    } catch (error: any) {
        addLog(`Render Failed: ${error.message}`, 'error');
    } finally {
        setProcessingShotId(null);
    }
  };

  // 4. Render Shot Video
  const renderShotVideo = async (sceneId: string, beatId: string, shot: Shot) => {
    if (!shot.imageUrl) {
        addLog("Error: Missing Source Frame", 'warning');
        return;
    }
    try {
        setProcessingShotId(shot.id);
        addLog(`Initiating Veo Simulation: ${shot.id}`, 'warning');
        
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
        addLog(`Motion Sequence Finalized: ${shot.id}`, 'success');
    } catch (error: any) {
        addLog(`Veo Error: ${error.message}`, 'error');
    } finally {
        setProcessingShotId(null);
    }
  };

  const getActiveScene = () => scriptData?.scenes.find(s => s.id === selectedSceneId);
  const getActiveBeat = () => getActiveScene()?.beats.find(b => b.id === selectedBeatId);

  return (
    <div className="relative min-h-screen text-[#F0F0F0] font-sans selection:bg-[#FF4500] selection:text-white bg-[#050505] overflow-hidden flex flex-col">
      <AsciiBackground />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-14 border-b border-[#333] bg-[#050505]/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('LANDING')}>
            <Film className="w-5 h-5 text-[var(--color-accent)]" />
            <h1 className="text-lg font-bold tracking-tighter font-serif">CINE-OS <span className="text-[10px] font-mono font-normal opacity-50 ml-2">PROD_PIPELINE_V4</span></h1>
        </div>
        <div className="flex items-center gap-4">
            {state !== ProcessingState.IDLE && state !== ProcessingState.COMPLETE && (
                <div className="text-[10px] font-mono text-[var(--color-accent)] animate-pulse flex items-center gap-2">
                    <Zap size={12} /> PROCESSING_NODE_ACTIVE
                </div>
            )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 pt-14 flex flex-col relative z-10">
        
        <AnimatePresence mode='wait'>
            
            {/* VIEW 1: LANDING PAGE */}
            {view === 'LANDING' && (
                <motion.div 
                    key="landing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 flex flex-col items-center justify-center p-8 relative"
                >
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <div className="w-[80vw] h-[80vw] border border-white rounded-full animate-[spin_60s_linear_infinite]" />
                        <div className="w-[60vw] h-[60vw] border border-white rounded-full absolute animate-[spin_40s_linear_infinite_reverse]" />
                    </div>

                    <motion.div 
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="text-center space-y-8 z-10"
                    >
                        <h1 className="text-8xl md:text-9xl font-serif tracking-tighter leading-none text-white mix-blend-difference">
                            CODE<br/><span className="text-[var(--color-accent)]">TO</span><br/>CINEMA
                        </h1>
                        <p className="font-mono text-sm tracking-[0.3em] text-gray-400">
                            A.I. POWERED FILMMAKING PIPELINE
                        </p>
                        
                        <div className="pt-8">
                            <button 
                                onClick={() => setView('IMPORT')}
                                className="group relative px-8 py-4 bg-transparent border border-[#333] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all duration-300"
                            >
                                <span className="flex items-center gap-3 font-mono text-xs tracking-widest group-hover:text-white transition-colors">
                                    INITIALIZE SYSTEM <ArrowRight className="w-4 h-4" />
                                </span>
                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </motion.div>

                    <div className="absolute bottom-12 w-full max-w-4xl flex justify-between text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                        <span>Gemini 2.5 Flash [ONLINE]</span>
                        <span>Veo 3.1 Preview [ONLINE]</span>
                        <span>Latency: 12ms</span>
                    </div>
                </motion.div>
            )}

            {/* VIEW 2: IMPORT SELECTION */}
            {view === 'IMPORT' && (
                <motion.div 
                    key="import"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 flex flex-col items-center justify-center p-8 max-w-7xl mx-auto w-full"
                >
                    <motion.div 
                         initial={{ y: 20, opacity: 0 }}
                         animate={{ y: 0, opacity: 1 }}
                         className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-serif mb-4">Select Source Material</h2>
                        <p className="text-gray-500 font-mono text-xs">CHOOSE INPUT FORMAT FOR PROCESSING</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                        {/* OPTION A: NOVEL */}
                        <motion.div 
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="group relative border border-[#222] bg-[#0A0A0A] hover:border-[var(--color-accent)] transition-all duration-500 cursor-pointer h-[400px] flex flex-col p-8"
                            onClick={() => novelInputRef.current?.click()}
                        >
                            <input type="file" ref={novelInputRef} className="hidden" accept=".txt,.md" onChange={(e) => handleFileUpload(e, 'NOVEL')} />
                            <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity text-[var(--color-accent)]">
                                <Book size={24} />
                            </div>
                            
                            <div className="mt-auto">
                                <div className="w-12 h-1 bg-gray-800 group-hover:bg-[var(--color-accent)] mb-6 transition-colors" />
                                <h3 className="text-2xl font-serif mb-2 text-gray-200 group-hover:text-white">Import Manuscript</h3>
                                <p className="text-xs font-mono text-gray-500 mb-6 leading-relaxed">
                                    Raw novel text. The system will act as a Screenwriter to adapt narrative into scenes, extract assets, and format dialogue.
                                </p>
                                <span className="text-[10px] font-mono border border-[#333] px-2 py-1 text-gray-400 group-hover:text-[var(--color-accent)] group-hover:border-[var(--color-accent)] transition-colors">
                                    MODE: ADAPTATION
                                </span>
                            </div>
                        </motion.div>

                        {/* OPTION B: SCRIPT */}
                        <motion.div 
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="group relative border border-[#222] bg-[#0A0A0A] hover:border-[var(--color-accent)] transition-all duration-500 cursor-pointer h-[400px] flex flex-col p-8"
                            onClick={() => scriptInputRef.current?.click()}
                        >
                            <input type="file" ref={scriptInputRef} className="hidden" accept=".txt,.md" onChange={(e) => handleFileUpload(e, 'SCRIPT')} />
                            <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity text-[var(--color-accent)]">
                                <FileType size={24} />
                            </div>
                            
                            <div className="mt-auto">
                                <div className="w-12 h-1 bg-gray-800 group-hover:bg-[var(--color-accent)] mb-6 transition-colors" />
                                <h3 className="text-2xl font-serif mb-2 text-gray-200 group-hover:text-white">Import Screenplay</h3>
                                <p className="text-xs font-mono text-gray-500 mb-6 leading-relaxed">
                                    Formatted script text. The system will parse existing Sluglines and structure, strictly preserving your dialogue and pacing.
                                </p>
                                <span className="text-[10px] font-mono border border-[#333] px-2 py-1 text-gray-400 group-hover:text-[var(--color-accent)] group-hover:border-[var(--color-accent)] transition-colors">
                                    MODE: PARSE_ONLY
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 3: WORKSPACE */}
            {view === 'WORKSPACE' && (
                <motion.div 
                    key="workspace"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 grid grid-cols-12 overflow-hidden h-full"
                >
                     {state === ProcessingState.ANALYZING_SCRIPT ? (
                         <div className="col-span-12 flex items-center justify-center flex-col gap-8">
                             <Loader text="DECONSTRUCTING TEXT" />
                             <p className="text-xs font-mono text-gray-500 animate-pulse">Running Narrative Analysis...</p>
                         </div>
                     ) : !scriptData ? (
                        <div className="col-span-12 flex items-center justify-center">
                            <p className="text-red-500 font-mono">ERROR: NO DATA LOADED</p>
                        </div>
                     ) : (
                        <>
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
                        </>
                     )}
                </motion.div>
            )}

        </AnimatePresence>

        {/* Console / Terminal Overlay */}
        <Terminal logs={logs} />

      </main>
    </div>
  );
};

export default App;