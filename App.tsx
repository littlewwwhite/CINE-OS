import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Film, Video as VideoIcon, Camera, Users, Zap, Image as ImageIcon, ChevronDown, ChevronRight, FileText, ArrowRight, Book, FileType, Play, CheckCircle, Cpu, Globe, Layers, MessageSquare, HelpCircle, Terminal as TerminalIcon, Github, Twitter, ChevronLeft, Layout, Maximize2 } from 'lucide-react';
import AsciiBackground from './components/AsciiBackground';
import Terminal from './components/Terminal';
import Loader from './components/Loader';
import Cursor from './components/Cursor';
import { analyzeNovel, generateShotsForBeat, generateShotImage, generateShotVideo } from './services/gemini';
import { ProcessingState, ScriptData, LogEntry, Scene, Beat, Shot } from './types';

type ViewState = 'LANDING' | 'IMPORT' | 'WORKSPACE';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const letterContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.2 }
  }
};

const letterAnimation = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 100 } }
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  
  // Workspace UI State
  const [isAssetsPanelOpen, setIsAssetsPanelOpen] = useState(true);
  
  // Selection State
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [processingShotId, setProcessingShotId] = useState<string | null>(null);
  
  // File Input Refs
  const novelInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  // LANDING PAGE SECTIONS
  const FAQs = [
      { q: "Can I import raw text?", a: "Yes. The 'Novel Mode' utilizes Gemini 2.5's reasoning capabilities to parse unstructured text into standard screenplay format, identifying sluglines and dialogue automatically." },
      { q: "What is the resolution output?", a: "Images are generated at 2K resolution via Gemini 2.5 Flash Image. Video synthesis is handled by Veo 3.1 at 720p/1080p depending on the complexity of the motion vector." },
      { q: "How is consistency maintained?", a: "We use a global asset registry. Once a character is defined, their visual embeddings (hair, clothes, style) are injected into every prompt to prevent 'character hallucination' between shots." },
      { q: "Is this real-time?", a: "Text processing is near-instant. Image generation takes ~3s per shot. Video generation is heavy compute and takes ~10-20s per shot." }
  ];

  const TitleText = ({ text, className }: { text: string, className?: string }) => (
    <motion.span variants={letterContainer} initial="hidden" animate="visible" className={`inline-block ${className}`}>
        {text.split('').map((char, i) => (
            <motion.span key={i} variants={letterAnimation} className="inline-block">
                {char === ' ' ? '\u00A0' : char}
            </motion.span>
        ))}
    </motion.span>
  );

  return (
    <div className="relative min-h-screen text-[#F0F0F0] font-sans selection:bg-[#FF4500] selection:text-white bg-[#050505] overflow-hidden flex flex-col cursor-none">
      <Cursor />
      <AsciiBackground />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-14 border-b border-[#333] bg-[#050505]/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setView('LANDING')}>
            <Film className="w-5 h-5 text-[var(--color-accent)] group-hover:animate-spin-slow" />
            <h1 className="text-lg font-bold tracking-tighter font-serif">CINE-OS <span className="text-[10px] font-mono font-normal opacity-50 ml-2">PROD_PIPELINE_V4</span></h1>
        </div>
        <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-[10px] font-mono tracking-widest text-gray-400">
                <button onClick={() => setView('LANDING')} className="hover:text-white transition-colors">SYSTEM</button>
                <button onClick={() => setView('IMPORT')} className="hover:text-white transition-colors">IMPORT</button>
                <a href="#" className="hover:text-white transition-colors">DOCS</a>
            </nav>
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
            
            {/* VIEW 1: LANDING PAGE (SCROLLABLE HOMEPAGE) */}
            {view === 'LANDING' && (
                <motion.div 
                    key="landing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar h-[calc(100vh-3.5rem)]"
                >
                    {/* SECTION 1: HERO */}
                    <motion.section 
                        className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 relative border-b border-[#222]"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                            <div className="w-[80vw] h-[80vw] border border-white rounded-full animate-[spin_60s_linear_infinite]" />
                            <div className="w-[60vw] h-[60vw] border border-white rounded-full absolute animate-[spin_40s_linear_infinite_reverse]" />
                        </div>

                        <div className="text-center space-y-8 z-10 max-w-5xl">
                            <div className="text-7xl md:text-9xl font-serif tracking-tighter leading-[0.8] text-white mix-blend-difference hover:tracking-wide transition-all duration-700">
                                <TitleText text="CODE" className="block" />
                                <TitleText text="TO" className="block text-[var(--color-accent)]" />
                                <TitleText text="CINEMA" className="block" />
                            </div>
                            
                            <motion.p 
                                variants={fadeInUp}
                                className="font-mono text-sm md:text-base tracking-[0.3em] text-gray-400 max-w-2xl mx-auto"
                            >
                                THE WORLD'S FIRST GENERATIVE FILMMAKING COMPILER.
                                TRANSFORM MANUSCRIPTS INTO MOVING PICTURES.
                            </motion.p>
                            
                            <motion.div className="pt-8" variants={fadeInUp}>
                                <button 
                                    onClick={() => setView('IMPORT')}
                                    className="group relative px-12 py-6 bg-transparent border border-[#333] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all duration-300 overflow-hidden"
                                >
                                    <span className="flex items-center gap-3 font-mono text-xs tracking-widest group-hover:text-white transition-colors relative z-10">
                                        INITIALIZE SYSTEM <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    <div className="absolute inset-0 bg-[var(--color-accent)]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </motion.div>
                        </div>
                    </motion.section>

                    {/* SECTION 2: SOCIAL PROOF / NETWORK */}
                    <section className="border-b border-[#222] bg-[#0A0A0A] py-8 overflow-hidden whitespace-nowrap">
                        <div className="flex items-center gap-16 animate-marquee text-gray-600 font-mono text-xs tracking-widest opacity-50">
                            {[1,2,3,4].map(i => (
                                <React.Fragment key={i}>
                                    <span className="flex items-center gap-2"><Cpu size={14}/> POWERED BY GEMINI 2.5</span>
                                    <span className="flex items-center gap-2"><VideoIcon size={14}/> VIDEO BY VEO 3.1</span>
                                    <span className="flex items-center gap-2"><Globe size={14}/> GOOGLE CLOUD VERTEX</span>
                                    <span className="flex items-center gap-2"><Layers size={14}/> REACT 19 KERNEL</span>
                                </React.Fragment>
                            ))}
                        </div>
                    </section>

                    {/* SECTION 3: PROBLEM STATEMENT */}
                    <motion.section 
                        className="py-24 px-8 border-b border-[#222] bg-white text-black"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={staggerContainer}
                    >
                        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
                            <motion.div variants={fadeInUp}>
                                <h3 className="font-mono text-xs tracking-widest mb-6 text-gray-500">THE BOTTLENECK</h3>
                                <h2 className="text-5xl font-serif leading-tight mb-6">
                                    Text is static.<br/>Imagination is fluid.
                                </h2>
                                <p className="font-mono text-sm leading-relaxed text-gray-600">
                                    Traditional pre-visualization requires weeks of storyboarding, expensive concept artists, and ambiguous communication. The gap between the writer's mind and the director's screen is where the budget dies.
                                </p>
                            </motion.div>
                            <div className="flex flex-col justify-center space-y-4 font-mono text-xs">
                                <motion.div variants={fadeInUp} className="p-4 border border-black flex items-center justify-between opacity-50">
                                    <span>SCRIPT.PDF</span>
                                    <span className="text-red-500">READING...</span>
                                </motion.div>
                                <motion.div variants={fadeInUp} className="p-4 border border-black flex items-center justify-between opacity-75">
                                    <span>STORYBOARD.JPG</span>
                                    <span className="text-orange-500">PENDING...</span>
                                </motion.div>
                                <motion.div variants={fadeInUp} className="p-4 bg-black text-white flex items-center justify-between scale-105 shadow-xl">
                                    <span>CINE-OS_RENDER.MP4</span>
                                    <span className="text-[var(--color-accent)] animate-pulse">GENERATING...</span>
                                </motion.div>
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 4: ARCHITECTURE (FEATURES) */}
                    <motion.section 
                        className="py-24 px-8 border-b border-[#222] bg-[#050505]"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={staggerContainer}
                    >
                        <div className="max-w-6xl mx-auto">
                            <motion.h3 variants={fadeInUp} className="font-mono text-xs tracking-widest mb-12 text-gray-500">SYSTEM ARCHITECTURE</motion.h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#222] border border-[#222]">
                                {[
                                    { title: "Semantic Parser", icon: <FileText/>, desc: "Deconstructs raw narrative into atomic beats and structured scenes using Gemini 2.5 Pro." },
                                    { title: "Consistency Engine", icon: <Users/>, desc: "Maintains a persistent vector database of character assets to ensure visual continuity." },
                                    { title: "Physics Renderer", icon: <Film/>, desc: "Veo 3.1 simulates camera lenses, lighting physics, and motion vectors for photorealism." },
                                ].map((feature, idx) => (
                                    <motion.div variants={fadeInUp} key={idx} className="bg-[#0A0A0A] p-8 hover:bg-[#111] transition-colors group">
                                        <div className="mb-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform origin-left">
                                            {feature.icon}
                                        </div>
                                        <h4 className="text-xl font-serif text-white mb-4">{feature.title}</h4>
                                        <p className="font-mono text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 5: HOW IT WORKS */}
                    <motion.section 
                        className="py-24 px-8 border-b border-[#222] relative overflow-hidden"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                    >
                        <div className="max-w-6xl mx-auto relative z-10">
                            <motion.h3 variants={fadeInUp} className="font-mono text-xs tracking-widest mb-16 text-center text-gray-500">THE PIPELINE</motion.h3>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-0">
                                <motion.div variants={fadeInUp} className="text-center group">
                                    <div className="w-20 h-20 border border-[#333] rounded-full flex items-center justify-center mx-auto mb-6 bg-[#0A0A0A] text-gray-400 group-hover:border-[var(--color-accent)] transition-colors">1</div>
                                    <h4 className="font-serif text-lg mb-2">Input</h4>
                                    <p className="font-mono text-xs text-gray-600">Drag & Drop Novel</p>
                                </motion.div>
                                <motion.div variants={fadeInUp} className="h-px w-24 bg-gradient-to-r from-[#333] via-[var(--color-accent)] to-[#333] hidden md:block opacity-50"></motion.div>
                                <motion.div variants={fadeInUp} className="text-center group">
                                    <div className="w-20 h-20 border border-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6 bg-[#0A0A0A] text-white shadow-[0_0_20px_rgba(255,69,0,0.3)] group-hover:scale-110 transition-transform">2</div>
                                    <h4 className="font-serif text-lg mb-2">Compile</h4>
                                    <p className="font-mono text-xs text-gray-600">AI Structure Analysis</p>
                                </motion.div>
                                <motion.div variants={fadeInUp} className="h-px w-24 bg-gradient-to-r from-[#333] via-[var(--color-accent)] to-[#333] hidden md:block opacity-50"></motion.div>
                                <motion.div variants={fadeInUp} className="text-center group">
                                    <div className="w-20 h-20 border border-[#333] rounded-full flex items-center justify-center mx-auto mb-6 bg-[#0A0A0A] text-gray-400 group-hover:border-[var(--color-accent)] transition-colors">3</div>
                                    <h4 className="font-serif text-lg mb-2">Render</h4>
                                    <p className="font-mono text-xs text-gray-600">4K Video Output</p>
                                </motion.div>
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 6: LOGS (TESTIMONIALS) */}
                    <motion.section 
                        className="py-24 px-8 border-b border-[#222] bg-[#080808]"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                    >
                        <div className="max-w-4xl mx-auto">
                            <motion.h3 variants={fadeInUp} className="font-mono text-xs tracking-widest mb-12 text-gray-500">TRANSMISSION LOGS</motion.h3>
                            <div className="space-y-4">
                                {[
                                    { user: "DIR_ANDERSON", role: "Showrunner", msg: "Latency reduced by 400%. The visualization allows me to spot plot holes before a single frame is shot." },
                                    { user: "WRITER_X", role: "Screenwriter", msg: "Seeing my words turn into consistent visuals instantly is terrifyingly beautiful. It changes how I write." }
                                ].map((log, i) => (
                                    <motion.div variants={fadeInUp} key={i} className="border-l-2 border-[#333] pl-6 py-2 hover:border-[var(--color-accent)] transition-colors cursor-default">
                                        <div className="flex items-center gap-3 mb-2 font-mono text-xs">
                                            <span className="text-[var(--color-accent)]">@{log.user}</span>
                                            <span className="bg-[#222] px-1.5 rounded text-[10px] text-gray-400">{log.role}</span>
                                        </div>
                                        <p className="text-gray-300 font-serif italic text-lg">"{log.msg}"</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 7: FAQ */}
                    <motion.section 
                        className="py-24 px-8 border-b border-[#222]"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        <div className="max-w-3xl mx-auto">
                            <motion.h3 variants={fadeInUp} className="font-mono text-xs tracking-widest mb-12 text-gray-500">KNOWLEDGE BASE</motion.h3>
                            <div className="space-y-2">
                                {FAQs.map((faq, idx) => (
                                    <motion.div variants={fadeInUp} key={idx} className="border border-[#222] bg-[#0A0A0A]">
                                        <button 
                                            onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                            className="w-full flex items-center justify-between p-6 text-left hover:bg-[#111] transition-colors"
                                        >
                                            <span className="font-mono text-sm text-gray-300 flex gap-4">
                                                <span className="text-[var(--color-accent)]">0{idx+1}.</span>
                                                {faq.q}
                                            </span>
                                            {openFaq === idx ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                        </button>
                                        <AnimatePresence>
                                            {openFaq === idx && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-6 pt-0 pl-14 text-sm font-serif text-gray-500 leading-relaxed border-t border-[#222] border-dashed">
                                                        {faq.a}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 8: FINAL CTA */}
                    <section className="py-32 px-8 flex flex-col items-center justify-center text-center bg-[#050505]">
                        <motion.h2 
                            initial={{ scale: 0.9, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8 }}
                            className="text-6xl font-serif mb-8 text-white"
                        >
                            Ready to Direct?
                        </motion.h2>
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setView('IMPORT')}
                            className="bg-[var(--color-accent)] text-black px-10 py-4 font-mono font-bold tracking-widest hover:bg-white transition-colors shadow-[0_0_30px_rgba(255,69,0,0.4)]"
                        >
                            LAUNCH CONSOLE
                        </motion.button>
                    </section>

                    {/* FOOTER */}
                    <footer className="py-12 px-8 border-t border-[#222] bg-[#020202] text-[10px] font-mono text-gray-600">
                        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Film size={14} /> <span>CINE-OS SYSTEMS INC. © 2025</span>
                            </div>
                            <div className="flex gap-8">
                                <a href="#" className="hover:text-white transition-colors">PRIVACY_PROTOCOL</a>
                                <a href="#" className="hover:text-white transition-colors">TERMS_OF_SERVICE</a>
                                <a href="#" className="hover:text-white transition-colors">API_STATUS</a>
                            </div>
                            <div className="flex gap-4">
                                <Github size={14} className="hover:text-white cursor-pointer"/>
                                <Twitter size={14} className="hover:text-white cursor-pointer"/>
                            </div>
                        </div>
                    </footer>
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

            {/* VIEW 3: WORKSPACE (OPTIMIZED LAYOUT) */}
            {view === 'WORKSPACE' && (
                <motion.div 
                    key="workspace"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex overflow-hidden h-full relative"
                >
                     {state === ProcessingState.ANALYZING_SCRIPT ? (
                         <div className="flex-1 flex items-center justify-center flex-col gap-8">
                             <Loader text="DECONSTRUCTING TEXT" />
                             <p className="text-xs font-mono text-gray-500 animate-pulse">Running Narrative Analysis...</p>
                         </div>
                     ) : !scriptData ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-red-500 font-mono">ERROR: NO DATA LOADED</p>
                        </div>
                     ) : (
                        <>
                            {/* PANEL 1: ASSETS (COLLAPSIBLE SIDEBAR) */}
                            <motion.div 
                                animate={{ width: isAssetsPanelOpen ? 280 : 40 }}
                                className="border-r border-[#333] flex flex-col bg-[#080808] flex-none relative transition-all duration-300 ease-in-out"
                            >
                                <div className="flex items-center gap-2 p-3 border-b border-[#333] h-[45px] overflow-hidden whitespace-nowrap">
                                    <Users className="w-3 h-3 text-gray-400 shrink-0" />
                                    <motion.h3 
                                        animate={{ opacity: isAssetsPanelOpen ? 1 : 0 }}
                                        className="font-mono text-[10px] text-gray-400 tracking-widest"
                                    >
                                        CASTING
                                    </motion.h3>
                                </div>
                                
                                <button 
                                    onClick={() => setIsAssetsPanelOpen(!isAssetsPanelOpen)}
                                    className="absolute -right-3 top-10 bg-[#333] border border-[#222] rounded-full p-0.5 z-20 text-gray-400 hover:text-white hover:bg-[var(--color-accent)] transition-colors"
                                >
                                    <ChevronLeft size={12} className={`transition-transform duration-300 ${!isAssetsPanelOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <div className={`flex-1 overflow-y-auto custom-scrollbar pb-20 ${!isAssetsPanelOpen ? 'hidden' : ''}`}>
                                    <div className="p-3 space-y-3">
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
                            </motion.div>

                            {/* PANEL 2: SCENE LIST (FIXED WIDTH, REFINED DENSITY) */}
                            <div className="w-96 border-r border-[#333] flex flex-col bg-[#050505] flex-none z-10">
                                <div className="flex items-center gap-2 p-3 border-b border-[#333] h-[45px]">
                                    <FileText className="w-3 h-3 text-gray-400" />
                                    <h3 className="font-mono text-[10px] text-gray-400 tracking-widest">SCENE LIST</h3>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                                    {scriptData.scenes.map((scene) => (
                                        <div key={scene.id} className="border-b border-[#222]">
                                            {/* Scene Header */}
                                            <div 
                                                onClick={() => toggleScene(scene.id)}
                                                className={`
                                                    p-3 cursor-pointer flex items-center justify-between group transition-colors sticky top-0 z-10 border-b border-[#222]
                                                    ${selectedSceneId === scene.id ? 'bg-[#1a1a1a] border-l-2 border-l-[var(--color-accent)] pl-[10px]' : 'bg-[#0A0A0A] hover:bg-[#111] border-l-2 border-l-transparent'}
                                                `}
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <h4 className={`font-bold text-[11px] font-mono transition-colors ${selectedSceneId === scene.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                        {scene.slugline}
                                                    </h4>
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
                                                                className={`
                                                                    p-2 pl-6 border-l border-[#222] cursor-pointer transition-all flex gap-3
                                                                    ${selectedBeatId === beat.id 
                                                                    ? 'bg-[var(--color-accent)]/10 text-white' 
                                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                                                                `}
                                                            >
                                                                <span className="font-mono text-[9px] opacity-40 shrink-0 mt-0.5">{String(idx + 1).padStart(2, '0')}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] leading-relaxed line-clamp-2">
                                                                        {beat.description}
                                                                    </p>
                                                                    {beat.shots.length > 0 && (
                                                                        <div className="mt-1 flex items-center gap-1">
                                                                            <Camera size={8} className="text-[var(--color-accent)]" />
                                                                            <span className="text-[8px] text-[var(--color-accent)]">{beat.shots.length} SHOTS</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {selectedBeatId === beat.id && <ChevronRight size={12} className="mt-1 shrink-0 text-[var(--color-accent)]" />}
                                                            </div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PANEL 3: SHOT EDITOR (DYNAMIC WIDTH) */}
                            <div className="flex-1 flex flex-col bg-[#080808] min-w-0">
                                <div className="flex items-center justify-between p-3 border-b border-[#333] h-[45px]">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Camera className="w-3 h-3 text-gray-400 shrink-0" />
                                        <h3 className="font-mono text-[10px] text-gray-400 tracking-widest truncate">
                                            {getActiveScene() ? `SHOT LIST: ${getActiveScene()?.slugline}` : 'WAITING FOR SELECTION...'}
                                        </h3>
                                    </div>
                                    {state === ProcessingState.GENERATING_SHOTS && (
                                         <span className="text-[9px] font-mono animate-pulse text-[var(--color-accent)] shrink-0">GENERATING SHOT LIST...</span>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-24 bg-[#0A0A0A]">
                                    {/* Responsive Container for Shots */}
                                    <div className="max-w-5xl mx-auto space-y-6">
                                        
                                        {getActiveBeat()?.shots.map((shot) => (
                                            <div key={shot.id} className="bg-[#050505] border border-[#222] p-0 flex flex-col md:flex-row group hover:border-[#444] transition-colors rounded-sm overflow-hidden shadow-lg">
                                                
                                                {/* Visual Preview Box */}
                                                <div className="md:w-72 aspect-video bg-black shrink-0 relative border-b md:border-b-0 md:border-r border-[#222] flex items-center justify-center overflow-hidden">
                                                    {shot.videoUrl ? (
                                                        <video src={shot.videoUrl} className="w-full h-full object-cover" controls loop muted autoPlay />
                                                    ) : shot.imageUrl ? (
                                                        <>
                                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm z-10">
                                                                <button 
                                                                    onClick={() => renderShotVideo(selectedSceneId!, selectedBeatId!, shot)}
                                                                    className="flex flex-col items-center gap-2 transform hover:scale-105 transition-transform"
                                                                >
                                                                    <div className="p-3 bg-[var(--color-accent)] rounded-full text-black">
                                                                        <VideoIcon className="w-5 h-5 fill-current" />
                                                                    </div>
                                                                    <span className="font-mono text-[9px] font-bold tracking-widest text-white">GENERATE MOTION</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0F0F0F] relative">
                                                            {/* Grid pattern background */}
                                                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                                            
                                                            {processingShotId === shot.id ? (
                                                                <Loader text="RENDERING" />
                                                            ) : (
                                                                <button 
                                                                    onClick={() => renderShotImage(selectedSceneId!, selectedBeatId!, shot)}
                                                                    className="flex flex-col items-center gap-3 group/btn z-10"
                                                                >
                                                                    <ImageIcon className="w-8 h-8 text-gray-700 group-hover/btn:text-white transition-colors" />
                                                                    <span className="text-[9px] font-mono text-gray-600 group-hover/btn:text-white tracking-widest border border-gray-800 px-3 py-1 rounded group-hover/btn:border-white transition-all">GENERATE FRAME</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur px-2 py-0.5 text-[9px] font-mono border border-white/10 text-white/90 z-20">
                                                        {shot.shotType.toUpperCase()}
                                                    </div>
                                                </div>

                                                {/* Shot Details */}
                                                <div className="flex-1 p-5 flex flex-col min-w-0">
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {shot.assetIds.map(aid => (
                                                            <span key={aid} className="text-[9px] px-2 py-1 border border-[#333] rounded-sm text-gray-400 bg-[#111] flex items-center gap-1">
                                                                <Users size={10} className="opacity-50" />
                                                                {scriptData?.assets.find(a => a.id === aid)?.name || aid}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="flex-1">
                                                        <h5 className="text-base font-serif text-white mb-3 leading-relaxed">{shot.action}</h5>
                                                        <div className="bg-[#111] p-3 rounded border border-[#222] relative">
                                                            <div className="absolute -top-2 left-2 px-1 bg-[#111] text-[9px] text-gray-500 font-mono">VISUAL PROMPT</div>
                                                            <p className="text-[11px] font-mono text-gray-400 leading-relaxed break-words">{shot.visualPrompt}</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-[#222] flex justify-between items-center">
                                                        <span className="font-mono text-[9px] text-gray-600">ID: {shot.id}</span>
                                                        <div className="flex gap-2">
                                                            {/* Placeholder actions */}
                                                            <Maximize2 size={12} className="text-gray-600 hover:text-white cursor-pointer" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {!selectedBeatId && (
                                            <div className="h-full min-h-[50vh] flex flex-col items-center justify-center text-gray-800 font-mono text-xs gap-4 opacity-50">
                                                <Layout size={48} strokeWidth={1} />
                                                <p>SELECT A BEAT FROM THE SCRIPT TO VIEW SHOT LIST</p>
                                            </div>
                                        )}

                                        {selectedBeatId && getActiveBeat()?.shots.length === 0 && state !== ProcessingState.GENERATING_SHOTS && (
                                             <div className="min-h-[40vh] flex flex-col items-center justify-center text-gray-600 font-mono text-xs gap-6 p-12 text-center border-2 border-dashed border-[#222] rounded-lg bg-[#080808]">
                                                <Film size={32} className="opacity-20" />
                                                <div className="space-y-2">
                                                    <p className="text-gray-400">NO SHOTS GENERATED</p>
                                                    <p className="opacity-50 max-w-xs mx-auto">The AI needs to analyze this beat to break it down into cinematic shots.</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleBeatSelect(getActiveScene()!, getActiveBeat()!)}
                                                    className="px-6 py-3 bg-[var(--color-accent)] text-black hover:bg-white transition-colors font-bold tracking-widest flex items-center gap-2"
                                                >
                                                    <Zap size={14} /> GENERATE SHOT LIST
                                                </button>
                                             </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                     )}
                </motion.div>
            )}

        </AnimatePresence>
      </main>

      <Terminal logs={logs} />
    </div>
  );
};

export default App;