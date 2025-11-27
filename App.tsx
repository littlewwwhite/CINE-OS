
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, Variants } from 'framer-motion';
import { Upload, Film, Video as VideoIcon, Camera, Users, Zap, Image as ImageIcon, ChevronDown, ChevronRight, FileText, ArrowRight, Book, FileType, Play, CheckCircle, Cpu, Globe, Layers, MessageSquare, HelpCircle, Terminal as TerminalIcon, Github, Twitter, ChevronLeft, Layout, Maximize2, Shield, Lock, Mail, Fingerprint, LogOut, HardDrive, Clock, Activity, Plus, MoreVertical, Folder, Sun, Moon } from 'lucide-react';
import AsciiBackground from './components/AsciiBackground';
import Terminal from './components/Terminal';
import Loader from './components/Loader';
import Cursor from './components/Cursor';
import DecryptedText from './components/DecryptedText';
import PixelBackground from './components/PixelBackground';
import { analyzeNovel, generateShotsForBeat, generateShotImage, generateShotVideo } from './services/gemini';
import { ProcessingState, ScriptData, LogEntry, Scene, Beat, Shot, Project, Asset } from './types';

type ViewState = 'LANDING' | 'AUTH' | 'DASHBOARD' | 'IMPORT' | 'WORKSPACE';
type Theme = 'DARK' | 'LIGHT';

interface User {
  id: string;
  name: string;
  email: string;
  tier: 'FREE' | 'PRO';
}

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const MOCK_PROJECTS: Project[] = [
    {
        id: 'PROJ-001',
        title: 'The Last Neuro-Link',
        lastModified: '2 HOURS AGO',
        sceneCount: 12,
        progress: 65,
        status: 'RENDERING'
    },
    {
        id: 'PROJ-002',
        title: 'Echoes of Silicon',
        lastModified: '1 DAY AGO',
        sceneCount: 8,
        progress: 30,
        status: 'DRAFT'
    },
    {
        id: 'PROJ-003',
        title: 'Void Walker',
        lastModified: '3 DAYS AGO',
        sceneCount: 24,
        progress: 100,
        status: 'COMPLETED'
    }
];

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [theme, setTheme] = useState<Theme>('DARK');
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  
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

  // Parallax Scroll Hooks
  const { scrollY } = useScroll();
  // Removed circular parallax transforms
  const opacityText = useTransform(scrollY, [0, 300], [1, 0]);

  // Apply Theme
  useEffect(() => {
    document.body.className = theme === 'LIGHT' ? 'light-mode' : '';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'DARK' ? 'LIGHT' : 'DARK');
    addLog(`THEME SWITCHED TO ${theme === 'DARK' ? 'LIGHT' : 'DARK'} MODE`, 'info');
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Auth Simulation
  const handleAuth = async (provider: 'GOOGLE' | 'GITHUB' | 'EMAIL') => {
      addLog(`INITIATING HANDSHAKE: ${provider}_OAUTH...`, 'info');
      // Simulated delay
      await new Promise(r => setTimeout(r, 1000));
      
      if (Math.random() > 0.9) {
          addLog(`CONNECTION RESET BY PEER. RETRYING...`, 'warning');
          await new Promise(r => setTimeout(r, 800));
      }

      setUser({
          id: `USR-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          name: 'DIRECTOR_01',
          email: 'user@cine-os.io',
          tier: 'PRO'
      });
      
      addLog('IDENTITY VERIFIED. ENCRYPTION KEYS EXCHANGED.', 'success');
      // Redirect to Dashboard after login
      setTimeout(() => setView('DASHBOARD'), 500);
  };

  const handleLogout = () => {
      setUser(null);
      setView('LANDING');
      addLog('SESSION TERMINATED.', 'info');
  };

  const loadProject = (project: Project) => {
      addLog(`LOADING PROJECT MODULE: ${project.id}`, 'info');
      // In a real app, fetch data here. For mock, we just switch view.
      // Mocking some script data for the "loaded" project
      setScriptData({
          title: project.title,
          genre: 'Sci-Fi',
          logline: 'Loaded from dashboard.',
          assets: [],
          scenes: []
      });
      setTimeout(() => setView('WORKSPACE'), 500);
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

  // --- MANUAL ADDITION HANDLERS ---

  const handleAddAsset = () => {
    const name = window.prompt("ENTER ASSET NAME (Character/Location):", "New Character");
    if (!name) return;
    
    const newAsset: Asset = {
        id: `asset_${Date.now()}`,
        name: name,
        type: 'CHARACTER',
        visualDescription: 'A placeholder description waiting for detailed inputs.'
    };

    setScriptData(prev => {
        if (!prev) return { title: 'New Project', genre: '', logline: '', assets: [newAsset], scenes: [] };
        return { ...prev, assets: [...prev.assets, newAsset] };
    });
    addLog(`Asset Created: ${name}`, 'success');
  };

  const handleAddScene = () => {
    const slugline = window.prompt("ENTER SCENE SLUGLINE (e.g., INT. VOID - NIGHT):", "INT. UNTITLED SCENE - DAY");
    if (!slugline) return;

    const newScene: Scene = {
        id: `scene_${Date.now()}`,
        slugline: slugline,
        beats: [],
        isExpanded: true
    };

    setScriptData(prev => {
         if (!prev) return { title: 'New Project', genre: '', logline: '', assets: [], scenes: [newScene] };
         return { ...prev, scenes: [...prev.scenes, newScene] };
    });
    addLog(`Scene Created: ${slugline}`, 'success');
  };

  const handleAddBeat = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation(); // Prevent toggling scene
    const description = window.prompt("ENTER BEAT ACTION/DESCRIPTION:", "A character walks into the room...");
    if (!description) return;

    const newBeat: Beat = {
        id: `beat_${Date.now()}`,
        description: description,
        shots: []
    };

    setScriptData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, beats: [...s.beats, newBeat] } : s)
        };
    });
    addLog(`Beat Added to Scene`, 'success');
  };

  const handleAddShot = () => {
    if (!selectedBeatId || !selectedSceneId) return;
    const prompt = window.prompt("ENTER VISUAL PROMPT FOR SHOT:", "Wide shot of the environment, cinematic lighting.");
    if (!prompt) return;

    const newShot: Shot = {
        id: `shot_${Date.now()}`,
        shotType: 'WIDE SHOT',
        visualPrompt: prompt,
        action: 'Static camera',
        assetIds: []
    };

    setScriptData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            scenes: prev.scenes.map(s => {
                if (s.id !== selectedSceneId) return s;
                return {
                    ...s,
                    beats: s.beats.map(b => b.id === selectedBeatId ? { ...b, shots: [...b.shots, newShot] } : b)
                };
            })
        };
    });
    addLog(`Manual Shot Created`, 'success');
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

  return (
    <div className="relative min-h-screen text-[var(--color-text-main)] font-sans selection:bg-[var(--color-accent)] selection:text-white bg-[var(--color-void)] overflow-hidden flex flex-col cursor-none transition-colors duration-300">
      <Cursor />
      <AsciiBackground theme={theme} />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-14 border-b border-[var(--color-line)] bg-[var(--color-void)]/90 backdrop-blur-md flex items-center justify-between px-6 z-50 transition-colors">
        <div 
            className="flex items-center gap-4 cursor-pointer group" 
            onClick={() => user ? setView('DASHBOARD') : setView('LANDING')}
        >
            <Film className="w-5 h-5 text-[var(--color-accent)] group-hover:animate-spin-slow" />
            <h1 className="text-lg font-bold tracking-tighter font-serif">CINE-OS <span className="text-[10px] font-mono font-normal opacity-50 ml-2">PROD_PIPELINE_V4</span></h1>
        </div>
        <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] items-center">
                {user ? (
                    <>
                        <span className="text-[var(--color-accent)] flex items-center gap-2">
                             <Fingerprint size={12}/> {user.id} <span className="text-[var(--color-text-muted)]">//</span> {user.name}
                        </span>
                        <button onClick={handleLogout} className="hover:text-red-500 transition-colors flex items-center gap-1">
                            <LogOut size={12}/> DISCONNECT
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setView('LANDING')} className="hover:text-[var(--color-text-main)] transition-colors">SYSTEM</button>
                        <button onClick={() => setView('AUTH')} className="hover:text-[var(--color-text-main)] transition-colors">LOGIN</button>
                        <a href="#" className="hover:text-[var(--color-text-main)] transition-colors">DOCS</a>
                    </>
                )}
                {/* Theme Toggle */}
                <button onClick={toggleTheme} className="hover:text-[var(--color-text-main)] transition-colors">
                    {theme === 'DARK' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
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
            
            {/* VIEW 1: LANDING PAGE */}
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
                        className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-8 relative border-b border-[var(--color-line)] overflow-hidden"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        {/* Pixel Background - Replaces Rings */}
                        <PixelBackground theme={theme} />

                        {/* Spotlight Gradient - Adapted for theme */}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] pointer-events-none ${theme === 'DARK' ? 'bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0)_60%)]' : 'bg-[radial-gradient(circle,rgba(0,0,0,0.03)_0%,rgba(255,255,255,0)_60%)]'}`} />

                        <motion.div style={{ opacity: opacityText }} className="text-center space-y-12 z-10 max-w-7xl">
                            <div className="flex flex-col items-center justify-center select-none">
                                <div className="flex flex-col items-center text-8xl md:text-[11rem] font-serif tracking-tighter leading-[0.85] text-[var(--color-text-main)] mix-blend-difference hover:tracking-wide transition-all duration-700 uppercase">
                                    <DecryptedText text="CODE" speed={100} delay={200} />
                                    <span className="text-[var(--color-accent)]">
                                        <DecryptedText text="TO" speed={100} delay={800} />
                                    </span>
                                    <DecryptedText text="CINEMA" speed={80} delay={1400} />
                                </div>
                            </div>
                            
                            <motion.p 
                                variants={fadeInUp}
                                className="font-mono text-sm md:text-base tracking-[0.3em] text-[var(--color-text-muted)] max-w-2xl mx-auto uppercase"
                            >
                                The world's first generative filmmaking compiler.<br/>
                                Transform manuscripts into moving pictures.
                            </motion.p>
                            
                            <motion.div className="pt-8" variants={fadeInUp}>
                                <button 
                                    onClick={() => setView('AUTH')}
                                    className="group relative px-12 py-6 bg-transparent border border-[var(--color-line)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all duration-300 overflow-hidden"
                                >
                                    <span className="flex items-center gap-3 font-mono text-xs tracking-widest group-hover:text-[var(--color-text-main)] transition-colors relative z-10">
                                        INITIALIZE SYSTEM <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    <div className="absolute inset-0 bg-[var(--color-accent)]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </motion.div>
                        </motion.div>
                    </motion.section>

                    {/* SECTION 2: SOCIAL PROOF */}
                    <section className="border-b border-[var(--color-line)] bg-[var(--color-card)] py-8 overflow-hidden whitespace-nowrap z-20 relative transition-colors">
                        <div className="flex items-center gap-16 animate-marquee text-[var(--color-text-muted)] font-mono text-xs tracking-widest opacity-50">
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
                        className={`py-32 px-8 border-b border-[var(--color-line)] min-h-screen flex items-center transition-colors ${theme === 'DARK' ? 'bg-white text-black' : 'bg-black text-white'}`}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.1 }}
                    >
                        {/* Note: This section intentionally inverts the current theme for contrast */}
                        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-16">
                            <div className="md:col-span-4 relative">
                                <div className="md:sticky md:top-32">
                                    <h3 className={`font-mono text-xs tracking-widest mb-6 border-b pb-4 ${theme === 'DARK' ? 'text-gray-500 border-gray-200' : 'text-gray-400 border-gray-800'}`}>01 // THE BOTTLENECK</h3>
                                    <h2 className="text-6xl font-serif leading-none mb-6">
                                        Text is static.<br/>Imagination is fluid.
                                    </h2>
                                </div>
                            </div>
                            
                            <div className="md:col-span-8 flex flex-col gap-12 pt-8">
                                <motion.p variants={fadeInUp} className={`font-mono text-lg leading-relaxed border-l-2 pl-8 ${theme === 'DARK' ? 'text-gray-800 border-black' : 'text-gray-200 border-white'}`}>
                                    Traditional pre-visualization requires weeks of storyboarding, expensive concept artists, and ambiguous communication. The gap between the writer's mind and the director's screen is where the budget dies.
                                </motion.p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                                    <motion.div variants={fadeInUp} className={`p-8 border ${theme === 'DARK' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
                                        <FileText className="w-8 h-8 mb-4 opacity-50" />
                                        <h4 className="font-bold text-xl mb-2">Ambiguous Scripts</h4>
                                        <p className="text-sm opacity-60">"Int. Lab - Day" means a thousand different things to a thousand different people.</p>
                                    </motion.div>
                                    <motion.div variants={fadeInUp} className={`p-8 border ${theme === 'DARK' ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
                                        <Clock className="w-8 h-8 mb-4 opacity-50" />
                                        <h4 className="font-bold text-xl mb-2">Linear Time</h4>
                                        <p className="text-sm opacity-60">Storyboarding takes days. AI generation takes seconds. Iterate at the speed of thought.</p>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 4: ARCHITECTURE */}
                    <motion.section 
                        className="py-32 px-8 border-b border-[var(--color-line)]"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                         <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-16">
                            <div className="md:col-span-4 relative">
                                <div className="md:sticky md:top-32">
                                     <h3 className="text-[var(--color-text-muted)] font-mono text-xs tracking-widest mb-6 border-b border-[var(--color-line)] pb-4">02 // SYSTEM ARCHITECTURE</h3>
                                     <h2 className="text-5xl font-serif leading-none mb-6">Modular<br/>Intelligence.</h2>
                                </div>
                            </div>
                            <div className="md:col-span-8">
                                <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--color-line)] border border-[var(--color-line)]">
                                    {[
                                        { title: "Gemini 2.5 Parser", desc: "Understands narrative nuance, subtext, and emotional beats.", icon: <Book /> },
                                        { title: "Context Injector", desc: "Maintains character consistency across shots using vector embeddings.", icon: <Shield /> },
                                        { title: "Veo 3.1 Renderer", desc: "High-fidelity video synthesis with cinematic camera motion control.", icon: <VideoIcon /> },
                                        { title: "React 19 Core", desc: "Real-time, zero-latency interface for rapid editorial decisions.", icon: <Layout /> }
                                    ].map((item, i) => (
                                        <motion.div key={i} variants={fadeInUp} className="bg-[var(--color-card)] p-12 hover:bg-[var(--color-panel)] transition-colors group">
                                            <div className="mb-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform origin-left">{item.icon}</div>
                                            <h4 className="font-mono text-lg font-bold mb-2">{item.title}</h4>
                                            <p className="text-[var(--color-text-muted)] text-sm">{item.desc}</p>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 5: PIPELINE */}
                    <motion.section className="py-32 px-8 border-b border-[var(--color-line)] bg-[var(--color-panel)]">
                         <div className="max-w-7xl mx-auto">
                            <div className="text-center mb-24">
                                <h3 className="text-[var(--color-text-muted)] font-mono text-xs tracking-widest mb-4">03 // THE PIPELINE</h3>
                                <h2 className="text-4xl md:text-5xl font-serif">From Raw Data to Final Cut</h2>
                            </div>
                            
                            <div className="relative">
                                <div className="absolute top-1/2 left-0 w-full h-px bg-[var(--color-line)] -translate-y-1/2 hidden md:block" />
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                    {[
                                        { step: "01", title: "Ingest", desc: "Upload novel or screenplay." },
                                        { step: "02", title: "Parse", desc: "AI extracts scenes & assets." },
                                        { step: "03", title: "Visualize", desc: "Generate 2K storyboards." },
                                        { step: "04", title: "Render", desc: "Synthesize 1080p video." }
                                    ].map((s, i) => (
                                        <div key={i} className="relative bg-[var(--color-card)] p-8 border border-[var(--color-line)] hover:border-[var(--color-accent)] transition-colors group">
                                            <div className="text-6xl font-serif text-[var(--color-line)] group-hover:text-[var(--color-accent)] transition-colors mb-4 opacity-20">{s.step}</div>
                                            <h4 className="font-bold mb-2">{s.title}</h4>
                                            <p className="text-xs text-[var(--color-text-muted)] font-mono">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         </div>
                    </motion.section>

                     {/* SECTION 6: LOGS */}
                     <motion.section className="py-32 px-8 border-b border-[var(--color-line)]">
                        <div className="max-w-4xl mx-auto">
                             <div className="flex items-center gap-4 mb-12 border-b border-[var(--color-line)] pb-4">
                                <TerminalIcon className="text-[var(--color-accent)]" />
                                <h3 className="font-mono text-sm tracking-widest">VERIFIED_USER_LOGS</h3>
                             </div>
                             <div className="space-y-4 font-mono text-xs md:text-sm">
                                {[
                                    { user: "DIR_NOLAN", msg: "Latency reduced by 94%. Pre-viz complete in 4 hours instead of 4 weeks.", status: "SUCCESS" },
                                    { user: "PROD_A24", msg: "Asset consistency check passed. Character 'Evelyn' stable across 42 shots.", status: "VERIFIED" },
                                    { user: "INDIE_DEV", msg: "Render quality exceeds expectations. Veo 3.1 handling complex lighting vectors perfectly.", status: "OPTIMAL" }
                                ].map((log, i) => (
                                    <div key={i} className="flex gap-4 p-4 bg-[var(--color-card)] border border-[var(--color-line)]">
                                        <span className="text-[var(--color-text-muted)] shrink-0">{new Date().toLocaleDateString()}</span>
                                        <span className="text-[var(--color-accent)] shrink-0">[{log.user}]</span>
                                        <span className="flex-1 text-[var(--color-text-muted)]">"{log.msg}"</span>
                                        <span className="text-green-500 font-bold hidden md:block">[{log.status}]</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                     </motion.section>

                    {/* SECTION 7: FAQ */}
                    <motion.section className="py-32 px-8 border-b border-[var(--color-line)] bg-[var(--color-card)]">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl font-serif mb-12 text-center">Knowledge Base</h2>
                            <div className="space-y-px bg-[var(--color-line)] border border-[var(--color-line)]">
                                {FAQs.map((faq, i) => (
                                    <div key={i} className="bg-[var(--color-void)]">
                                        <button 
                                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                            className="w-full flex items-center justify-between p-6 hover:bg-[var(--color-panel)] transition-colors text-left"
                                        >
                                            <span className="font-mono text-sm">{faq.q}</span>
                                            {openFaq === i ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                        </button>
                                        <AnimatePresence>
                                            {openFaq === i && (
                                                <motion.div 
                                                    initial={{ height: 0 }} 
                                                    animate={{ height: "auto" }} 
                                                    exit={{ height: 0 }} 
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-6 pt-0 text-[var(--color-text-muted)] text-sm leading-relaxed border-t border-[var(--color-line)] border-dashed">
                                                        {faq.a}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    {/* SECTION 8: FINAL CTA */}
                    <section className="py-40 px-8 flex flex-col items-center justify-center text-center">
                        <h2 className="text-6xl md:text-8xl font-serif mb-12 mix-blend-difference">Ready to Direct?</h2>
                        <button 
                            onClick={() => setView('AUTH')}
                            className="text-xl md:text-2xl font-mono border-b-2 border-[var(--color-accent)] pb-2 hover:text-[var(--color-accent)] transition-colors"
                        >
                            INITIALIZE_PIPELINE &rarr;
                        </button>
                    </section>

                    {/* FOOTER */}
                    <footer className="border-t border-[var(--color-line)] py-12 px-8 bg-[var(--color-card)]">
                        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div>
                                <h4 className="font-bold font-serif text-lg mb-2">CINE-OS</h4>
                                <p className="font-mono text-xs text-[var(--color-text-muted)]">
                                    Build v4.0.1 (Stable)<br/>
                                    &copy; 2024 CINE-OS Inc.
                                </p>
                            </div>
                            <div className="flex gap-8 text-xs font-mono text-[var(--color-text-muted)]">
                                <a href="#" className="hover:text-[var(--color-accent)]">TERMS_OF_SERVICE</a>
                                <a href="#" className="hover:text-[var(--color-accent)]">PRIVACY_PROTOCOL</a>
                                <a href="#" className="hover:text-[var(--color-accent)]">SYSTEM_STATUS</a>
                            </div>
                        </div>
                    </footer>
                </motion.div>
            )}

            {/* VIEW 2: AUTH (BETTER AUTH STYLE) */}
            {view === 'AUTH' && (
                <motion.div
                    key="auth"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex-1 flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-md bg-[var(--color-card)] border border-[var(--color-line)] p-8 relative overflow-hidden">
                        {/* Decorative Scanner Line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-accent)]/50 animate-[shimmer_2s_infinite]" />
                        
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 border border-[var(--color-line)] rounded-full mx-auto mb-4 flex items-center justify-center relative">
                                <div className="absolute inset-0 border-t border-[var(--color-accent)] rounded-full animate-spin"></div>
                                <Shield className="w-6 h-6 text-[var(--color-text-muted)]" />
                            </div>
                            <h2 className="font-serif text-2xl">Identity Verification</h2>
                            <p className="font-mono text-xs text-[var(--color-text-muted)] mt-2">SECURE_HANDSHAKE_PROTOCOL_INITIATED</p>
                        </div>

                        <div className="space-y-4">
                            <button 
                                onClick={() => handleAuth('GOOGLE')}
                                className="w-full flex items-center justify-center gap-3 p-3 border border-[var(--color-line)] hover:bg-[var(--color-panel)] hover:border-[var(--color-text-main)] transition-colors font-mono text-xs"
                            >
                                <Globe size={14} /> CONTINUE_WITH_GOOGLE
                            </button>
                            <button 
                                onClick={() => handleAuth('GITHUB')}
                                className="w-full flex items-center justify-center gap-3 p-3 border border-[var(--color-line)] hover:bg-[var(--color-panel)] hover:border-[var(--color-text-main)] transition-colors font-mono text-xs"
                            >
                                <Github size={14} /> CONTINUE_WITH_GITHUB
                            </button>
                            
                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-line)]"></div></div>
                                <div className="relative flex justify-center"><span className="bg-[var(--color-card)] px-2 text-[10px] text-[var(--color-text-muted)] font-mono">OR_USE_MAGIC_LINK</span></div>
                            </div>

                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleAuth('EMAIL'); }}>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-mono text-[var(--color-text-muted)] ml-1">EMAIL_ADDRESS</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                        <input 
                                            type="email" 
                                            className="w-full bg-[var(--color-void)] border border-[var(--color-line)] p-3 pl-10 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                            placeholder="director@studio.io"
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-[var(--color-text-main)] text-[var(--color-void)] p-3 font-mono text-xs font-bold hover:bg-[var(--color-accent)] transition-colors">
                                    SEND_VERIFICATION_PACKET
                                </button>
                            </form>
                        </div>

                        <div className="mt-8 text-center">
                            <button onClick={() => setView('LANDING')} className="text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] flex items-center justify-center gap-1 mx-auto">
                                <ChevronLeft size={10} /> ABORT_SEQUENCE
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 3: DASHBOARD */}
            {view === 'DASHBOARD' && user && (
                <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 p-8 overflow-y-auto"
                >
                    <div className="max-w-6xl mx-auto space-y-12">
                        {/* Stats Module */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "STORAGE_USED", val: "42%", icon: <HardDrive/> },
                                { label: "RENDER_CREDITS", val: "8,400", icon: <Zap/> },
                                { label: "ACTIVE_PROJECTS", val: "03", icon: <Folder/> },
                                { label: "SYSTEM_LATENCY", val: "12ms", icon: <Activity/> },
                            ].map((stat, i) => (
                                <div key={i} className="bg-[var(--color-card)] p-4 border border-[var(--color-line)] flex items-center gap-4">
                                    <div className="text-[var(--color-accent)] opacity-80">{stat.icon}</div>
                                    <div>
                                        <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{stat.label}</div>
                                        <div className="text-xl font-bold font-mono">{stat.val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Projects Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-serif">Mission Control</h2>
                                <button 
                                    onClick={() => setView('IMPORT')}
                                    className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-4 py-2 text-xs font-mono font-bold hover:bg-[var(--color-accent)]/80 transition-colors"
                                >
                                    <Plus size={14} /> NEW_PROJECT
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {projects.map((proj) => (
                                    <div 
                                        key={proj.id} 
                                        onClick={() => loadProject(proj)}
                                        className="group bg-[var(--color-card)] border border-[var(--color-line)] cursor-pointer hover:border-[var(--color-accent)] transition-all relative overflow-hidden h-64 flex flex-col"
                                    >
                                        <div className="flex-1 bg-[var(--color-panel)] relative p-6 flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <div className="w-8 h-8 rounded border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-muted)]">
                                                    <Film size={16} />
                                                </div>
                                                <span className={`text-[10px] font-mono px-2 py-1 border ${
                                                    proj.status === 'COMPLETED' ? 'border-green-500 text-green-500' :
                                                    proj.status === 'RENDERING' ? 'border-yellow-500 text-yellow-500' : 'border-[var(--color-line)] text-[var(--color-text-muted)]'
                                                }`}>
                                                    {proj.status}
                                                </span>
                                            </div>
                                            <h3 className="font-serif text-xl group-hover:text-[var(--color-accent)] transition-colors">{proj.title}</h3>
                                        </div>
                                        <div className="p-4 border-t border-[var(--color-line)] bg-[var(--color-card)] text-[10px] font-mono text-[var(--color-text-muted)] flex justify-between items-center">
                                            <span>MODIFIED: {proj.lastModified}</span>
                                            <span>{proj.sceneCount} SCENES</span>
                                        </div>
                                        {/* Progress Bar for Rendering */}
                                        {proj.status === 'RENDERING' && (
                                            <div className="absolute bottom-0 left-0 h-1 bg-[var(--color-accent)]" style={{ width: `${proj.progress}%` }} />
                                        )}
                                    </div>
                                ))}
                                
                                {/* Dashed Placeholder for New Project */}
                                <button 
                                    onClick={() => setView('IMPORT')}
                                    className="border-2 border-dashed border-[var(--color-line)] h-64 flex flex-col items-center justify-center gap-4 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
                                >
                                    <Plus size={32} />
                                    <span className="font-mono text-xs tracking-widest">INITIATE_NEW_TIMELINE</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* VIEW 4: SELECTION / IMPORT (DUAL MODE) */}
            {view === 'IMPORT' && (
                <motion.div 
                    key="import"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center p-8"
                >
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-serif mb-4">Import Source Material</h2>
                        <p className="font-mono text-xs text-[var(--color-text-muted)] tracking-widest">SELECT_DATA_FORMAT</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                        {/* Option 1: Novel */}
                        <div 
                            className="group relative border border-[var(--color-line)] bg-[var(--color-card)] p-12 hover:border-[var(--color-accent)] transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-6"
                            onClick={() => novelInputRef.current?.click()}
                        >
                             <div className="w-16 h-16 border border-[var(--color-line)] rounded-full flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:border-[var(--color-accent)] transition-colors">
                                <Book size={32} />
                             </div>
                             <div>
                                <h3 className="text-xl font-serif font-bold mb-2">Raw Manuscript</h3>
                                <p className="text-xs font-mono text-[var(--color-text-muted)] leading-relaxed px-8">
                                    AI will analyze text, extract characters, identify locations, and format into a screenplay automatically.
                                </p>
                             </div>
                             <div className="mt-4 px-4 py-2 bg-[var(--color-void)] border border-[var(--color-line)] font-mono text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] transition-colors">
                                .TXT / .MD / .DOCX
                             </div>
                             <input 
                                type="file" 
                                ref={novelInputRef} 
                                className="hidden" 
                                accept=".txt,.md" 
                                onChange={(e) => handleFileUpload(e, 'NOVEL')} 
                            />
                        </div>

                         {/* Option 2: Script */}
                         <div 
                            className="group relative border border-[var(--color-line)] bg-[var(--color-card)] p-12 hover:border-[var(--color-accent)] transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-6"
                            onClick={() => scriptInputRef.current?.click()}
                        >
                             <div className="w-16 h-16 border border-[var(--color-line)] rounded-full flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:border-[var(--color-accent)] transition-colors">
                                <FileType size={32} />
                             </div>
                             <div>
                                <h3 className="text-xl font-serif font-bold mb-2">Formatted Screenplay</h3>
                                <p className="text-xs font-mono text-[var(--color-text-muted)] leading-relaxed px-8">
                                    AI will parse existing Scene Headings, Action, and Dialogue to build the visual breakdown immediately.
                                </p>
                             </div>
                             <div className="mt-4 px-4 py-2 bg-[var(--color-void)] border border-[var(--color-line)] font-mono text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] transition-colors">
                                .TXT / .PDF (Parsed)
                             </div>
                             <input 
                                type="file" 
                                ref={scriptInputRef} 
                                className="hidden" 
                                accept=".txt,.md" 
                                onChange={(e) => handleFileUpload(e, 'SCRIPT')} 
                            />
                        </div>
                    </div>

                    <button onClick={() => setView('DASHBOARD')} className="mt-12 text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                         &larr; RETURN_TO_DASHBOARD
                    </button>
                </motion.div>
            )}

            {/* VIEW 5: WORKSPACE (EDITOR) */}
            {view === 'WORKSPACE' && (
                <motion.div 
                    key="workspace"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-1 overflow-hidden"
                >
                    {/* LEFT PANEL: ASSETS */}
                    <motion.aside 
                        animate={{ width: isAssetsPanelOpen ? 300 : 0, opacity: isAssetsPanelOpen ? 1 : 0 }}
                        className="bg-[var(--color-panel)] border-r border-[var(--color-line)] overflow-hidden flex flex-col shrink-0"
                    >
                         <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between min-w-[300px]">
                            <h2 className="text-xs font-bold font-mono tracking-widest flex items-center gap-2">
                                <Users size={14} /> CASTING_DECK
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[var(--color-text-muted)]">{scriptData?.assets.length || 0} ITEMS</span>
                                <button onClick={handleAddAsset} className="p-1 hover:bg-[var(--color-accent)] hover:text-white rounded transition-colors" title="Add Asset">
                                    <Plus size={12} />
                                </button>
                            </div>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-[300px] custom-scrollbar">
                            {scriptData?.assets.map(asset => (
                                <div key={asset.id} className="p-3 border border-[var(--color-line)] bg-[var(--color-card)] hover:border-[var(--color-accent)] transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 border ${
                                            asset.type === 'CHARACTER' ? 'border-orange-500/50 text-orange-500' : 
                                            asset.type === 'LOCATION' ? 'border-blue-500/50 text-blue-500' : 'border-gray-500 text-gray-500'
                                        }`}>
                                            {asset.type.substring(0, 1)}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm mb-1 text-[var(--color-text-main)]">{asset.name}</h3>
                                    <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-3 group-hover:text-[var(--color-text-main)] transition-colors">
                                        {asset.visualDescription}
                                    </p>
                                </div>
                            ))}
                         </div>
                    </motion.aside>

                    {/* COLLAPSE TOGGLE */}
                    <button 
                        onClick={() => setIsAssetsPanelOpen(!isAssetsPanelOpen)}
                        className="w-4 bg-[var(--color-void)] border-r border-[var(--color-line)] flex items-center justify-center hover:bg-[var(--color-accent)] hover:text-white transition-colors z-20"
                    >
                        {isAssetsPanelOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                    </button>

                    {/* MIDDLE PANEL: SCRIPT / SCENES */}
                    <section className="flex-1 bg-[var(--color-void)] border-r border-[var(--color-line)] flex flex-col overflow-hidden relative">
                         <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-void)] z-10">
                            <h2 className="text-xs font-bold font-mono tracking-widest flex items-center gap-2">
                                <FileText size={14} /> SCRIPT_SEQUENCE
                            </h2>
                            <div className="flex items-center gap-2">
                                {state === ProcessingState.ANALYZING_SCRIPT && <Loader text="PARSING" />}
                                <button onClick={handleAddScene} className="p-1 hover:bg-[var(--color-accent)] hover:text-white rounded transition-colors" title="Add Scene">
                                    <Plus size={12} />
                                </button>
                            </div>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Empty State */}
                            {scriptData?.scenes.length === 0 && state !== ProcessingState.ANALYZING_SCRIPT && (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-8 p-12">
                                    <div className="flex flex-col items-center gap-4 opacity-50">
                                        <FileText size={48} />
                                        <p className="font-mono text-xs">NO SEQUENCE DATA</p>
                                    </div>
                                    
                                    {/* Quick Import Actions within Workspace */}
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => novelInputRef.current?.click()}
                                            className="px-6 py-3 border border-[var(--color-line)] bg-[var(--color-card)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors font-mono text-[10px] tracking-widest"
                                        >
                                            + IMPORT RAW NOVEL
                                        </button>
                                        <button 
                                            onClick={() => scriptInputRef.current?.click()}
                                            className="px-6 py-3 border border-[var(--color-line)] bg-[var(--color-card)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors font-mono text-[10px] tracking-widest"
                                        >
                                            + IMPORT SCREENPLAY
                                        </button>
                                    </div>
                                    
                                    {/* Hidden inputs to support the clicks */}
                                    <input 
                                        type="file" 
                                        ref={novelInputRef} 
                                        className="hidden" 
                                        accept=".txt,.md" 
                                        onChange={(e) => handleFileUpload(e, 'NOVEL')} 
                                    />
                                    <input 
                                        type="file" 
                                        ref={scriptInputRef} 
                                        className="hidden" 
                                        accept=".txt,.md" 
                                        onChange={(e) => handleFileUpload(e, 'SCRIPT')} 
                                    />
                                </div>
                            )}

                            <div className="pb-24"> {/* Padding for terminal */}
                                {scriptData?.scenes.map((scene) => (
                                    <div key={scene.id} className="border-b border-[var(--color-line)]">
                                        {/* SCENE HEADER (Sticky) */}
                                        <div 
                                            className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between cursor-pointer border-l-4 transition-colors ${
                                                selectedSceneId === scene.id ? 'bg-[var(--color-card)] border-l-[var(--color-accent)]' : 'bg-[var(--color-void)] border-l-transparent hover:bg-[var(--color-card)]'
                                            }`}
                                            onClick={() => toggleScene(scene.id)}
                                        >
                                            <h3 className="font-bold font-mono text-sm uppercase truncate max-w-[80%]">
                                                {scene.slugline}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                                <button 
                                                    onClick={(e) => handleAddBeat(e, scene.id)}
                                                    className="p-1 hover:bg-[var(--color-accent)] hover:text-white rounded transition-colors mr-2"
                                                    title="Add Beat"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                                <span className="text-[10px]">{scene.beats.length} BEATS</span>
                                                {scene.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </div>
                                        </div>

                                        {/* BEATS LIST */}
                                        <AnimatePresence>
                                            {scene.isExpanded && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="bg-[var(--color-panel)]/30 overflow-hidden"
                                                >
                                                    {scene.beats.map((beat) => (
                                                        <div 
                                                            key={beat.id}
                                                            onClick={() => handleBeatSelect(scene, beat)}
                                                            className={`px-8 py-3 border-b border-[var(--color-line)]/50 cursor-pointer transition-colors relative group ${
                                                                selectedBeatId === beat.id 
                                                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-main)]' 
                                                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-void)]'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-start gap-4">
                                                                <p className="font-serif text-sm leading-relaxed line-clamp-2 pointer-events-none">
                                                                    {beat.description}
                                                                </p>
                                                                <div className="shrink-0 flex flex-col items-end gap-1">
                                                                    <span className="text-[9px] font-mono opacity-50">BEAT {beat.id.split('_').pop()}</span>
                                                                    {beat.shots.length > 0 && (
                                                                         <span className="text-[9px] font-mono bg-[var(--color-line)] px-1 rounded text-[var(--color-text-main)]">
                                                                            {beat.shots.length} SHOTS
                                                                         </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Status Indicator */}
                                                            {selectedBeatId === beat.id && (
                                                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                         </div>
                    </section>

                    {/* RIGHT PANEL: SHOTS VISUALIZATION */}
                    <section className="flex-[1.2] bg-[var(--color-card)] flex flex-col overflow-hidden">
                         <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
                            <h2 className="text-xs font-bold font-mono tracking-widest flex items-center gap-2">
                                <Camera size={14} /> SHOT_LIST: {getActiveScene()?.slugline.split(' - ')[0] || "SELECT SCENE"}
                            </h2>
                            <div className="flex items-center gap-2">
                                {state === ProcessingState.GENERATING_SHOTS && <Loader text="DIRECTING" />}
                                <button 
                                    onClick={handleAddShot} 
                                    disabled={!selectedBeatId}
                                    className={`p-1 rounded transition-colors ${!selectedBeatId ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--color-accent)] hover:text-white'}`} 
                                    title="Add Shot"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                         </div>

                         <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                             {!selectedBeatId && (
                                 <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-4 opacity-50">
                                     <Layout size={48} />
                                     <p className="font-mono text-xs">SELECT A BEAT TO GENERATE SHOTS</p>
                                 </div>
                             )}

                             {getActiveBeat()?.shots.map((shot, idx) => (
                                 <motion.div 
                                    key={shot.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="border border-[var(--color-line)] bg-[var(--color-void)] p-4 group hover:border-[var(--color-text-muted)] transition-colors"
                                 >
                                     <div className="flex items-start gap-4 mb-4">
                                         {/* Media Preview Area */}
                                         <div className="w-1/3 aspect-video bg-[var(--color-panel)] border border-[var(--color-line)] relative overflow-hidden flex items-center justify-center group-hover:border-[var(--color-accent)] transition-colors">
                                             {shot.videoUrl ? (
                                                 <video src={shot.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                                             ) : shot.imageUrl ? (
                                                 <img src={shot.imageUrl} alt="Shot" className="w-full h-full object-cover" />
                                             ) : (
                                                 <div className="text-[var(--color-text-muted)] flex flex-col items-center gap-2">
                                                     {processingShotId === shot.id ? <Loader text="RENDERING" /> : <ImageIcon size={24} />}
                                                 </div>
                                             )}
                                             
                                             {/* Overlay Actions */}
                                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                 <button 
                                                    onClick={() => renderShotImage(selectedSceneId!, selectedBeatId!, shot)}
                                                    className="p-2 bg-[var(--color-void)] border border-[var(--color-line)] hover:text-[var(--color-accent)]"
                                                    title="Generate Image"
                                                 >
                                                     <ImageIcon size={14} />
                                                 </button>
                                                 {shot.imageUrl && (
                                                     <button 
                                                        onClick={() => renderShotVideo(selectedSceneId!, selectedBeatId!, shot)}
                                                        className="p-2 bg-[var(--color-void)] border border-[var(--color-line)] hover:text-[var(--color-accent)]"
                                                        title="Generate Video (Veo)"
                                                     >
                                                         <VideoIcon size={14} />
                                                     </button>
                                                 )}
                                             </div>
                                         </div>

                                         {/* Shot Details */}
                                         <div className="flex-1 space-y-2">
                                             <div className="flex items-center gap-2">
                                                 <span className="text-[9px] font-mono bg-[var(--color-line)] px-1.5 rounded text-[var(--color-text-main)]">
                                                     {shot.shotType.toUpperCase()}
                                                 </span>
                                             </div>
                                             <p className="font-serif text-sm leading-relaxed text-[var(--color-text-main)]">
                                                 {shot.visualPrompt}
                                             </p>
                                             <div className="pt-2 flex flex-wrap gap-2">
                                                 {shot.assetIds.map(aid => {
                                                     const asset = scriptData?.assets.find(a => a.id === aid);
                                                     if (!asset) return null;
                                                     return (
                                                         <span key={aid} className="text-[9px] font-mono border border-[var(--color-line)] px-2 py-0.5 rounded-full text-[var(--color-text-muted)]">
                                                             {asset.name}
                                                         </span>
                                                     );
                                                 })}
                                             </div>
                                         </div>
                                     </div>
                                 </motion.div>
                             ))}
                         </div>
                    </section>
                </motion.div>
            )}

        </AnimatePresence>

      </main>

      {/* GLOBAL TERMINAL LOGS */}
      <Terminal logs={logs} />
    </div>
  );
};

export default App;
