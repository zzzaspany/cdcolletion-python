import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Database, 
  Wifi, 
  WifiOff, 
  Disc, 
  Trash2, 
  SlidersHorizontal, 
  Music, 
  TrendingUp, 
  Layers, 
  Coins, 
  Sparkles, 
  BookOpen, 
  Check, 
  ArrowUpDown, 
  Code2, 
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';

interface CDItem {
  id: string;
  collectionId: string;
  collectionName: string;
  album: string;
  author: string;
  cdcondition: number; // 1-10 scale
  covercondition: number; // 1-10 scale
  price: string;
  file?: string[]; // file names for cover images in PocketBase
  created: string;
  updated: string;
}

// Initial demo items featuring the user's exact PocketBase item as item #1
const DEMO_ITEMS: CDItem[] = [
  {
    id: "rogalddldziwki1",
    collectionId: "pbc_386466699",
    collectionName: "audiocd",
    album: "dziwki dragi",
    author: "rogal ddl",
    cdcondition: 7,
    covercondition: 6,
    price: "120",
    file: ["4893993211067_wbo037jmba.jpg"],
    created: "2026-07-11 21:53:30.554Z",
    updated: "2026-07-11 21:53:30.554Z"
  },
  {
    id: "pezetnoonmuzyka",
    collectionId: "pbc_386466699",
    collectionName: "audiocd",
    album: "Muzyka Klasyczna",
    author: "Pezet-Noon",
    cdcondition: 9,
    covercondition: 8,
    price: "320",
    file: [],
    created: "2026-07-11 20:10:15.000Z",
    updated: "2026-07-11 20:10:15.000Z"
  },
  {
    id: "nirvananevermind",
    collectionId: "pbc_386466699",
    collectionName: "audiocd",
    album: "Nevermind",
    author: "Nirvana",
    cdcondition: 8,
    covercondition: 7,
    price: "95",
    file: [],
    created: "2026-07-11 18:42:00.000Z",
    updated: "2026-07-11 18:42:00.000Z"
  },
  {
    id: "pinkfloyddark",
    collectionId: "pbc_386466699",
    collectionName: "audiocd",
    album: "The Dark Side of the Moon",
    author: "Pink Floyd",
    cdcondition: 10,
    covercondition: 9,
    price: "150",
    file: [],
    created: "2026-07-11 15:30:22.000Z",
    updated: "2026-07-11 15:30:22.000Z"
  },
  {
    id: "kaliber44ksiega",
    collectionId: "pbc_386466699",
    collectionName: "audiocd",
    album: "Księga Tajemnicza. Prolog",
    author: "Kaliber 44",
    cdcondition: 6,
    covercondition: 5,
    price: "240",
    file: [],
    created: "2026-07-11 12:15:00.000Z",
    updated: "2026-07-11 12:15:00.000Z"
  }
];

export default function App() {
  const [pocketbaseUrl, setPocketbaseUrl] = useState<string>("http://127.0.0.1:8090");
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected');
  const [useDemoFallback, setUseDemoFallback] = useState<boolean>(true);
  const [cds, setCds] = useState<CDItem[]>(DEMO_ITEMS);
  const [loading, setLoading] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<'album' | 'author' | 'cdcondition' | 'covercondition' | 'price' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minCondition, setMinCondition] = useState<number>(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<'collection' | 'python' | 'help'>('collection');

  // Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [album, setAlbum] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [cdcondition, setCdcondition] = useState<number>(8);
  const [covercondition, setCovercondition] = useState<number>(8);
  const [price, setPrice] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate a unique CSS background gradient based on CD title hash (muted editorial tones)
  const getCoverGradient = (title: string, authorName: string) => {
    let hash = 0;
    const combined = `${title} ${authorName}`;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const palettes = [
      ['#4B5320', '#1C1D17'], // Olive & Dark Stone
      ['#4A2E2B', '#1B1414'], // Oxblood & Ink
      ['#2D3F44', '#131A1C'], // Deep Teal & Charcoal
      ['#5B4228', '#201610'], // Terracotta & Dark Brown
      ['#363D4A', '#13161C'], // Navy & Slate
    ];
    const palette = palettes[Math.abs(hash) % palettes.length];
    return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`;
  };

  // Check connection to the local PocketBase
  const checkPocketBaseConnection = async (urlToCheck: string, quiet = false) => {
    if (!quiet) setIsReconnecting(true);
    try {
      // Fetch audiocd collection to verify connection & collection existence
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const res = await fetch(`${urlToCheck}/api/collections/audiocd/records?perPage=1`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setConnectionStatus('connected');
        setUseDemoFallback(false);
        if (data.items) {
          // If empty, keep demo items or set empty
          setCds(data.items.length > 0 ? data.items : []);
        }
      } else {
        throw new Error("Collection request failed");
      }
    } catch (e) {
      console.log("Could not establish live connection to PocketBase, running in sandbox demo mode:", e);
      setConnectionStatus('disconnected');
      setUseDemoFallback(true);
      // Ensure we keep existing state or fall back to demo items
      if (cds.length === 0 || cds === DEMO_ITEMS) {
        setCds(DEMO_ITEMS);
      }
    } finally {
      setIsReconnecting(false);
    }
  };

  // Initial connection check on mount
  useEffect(() => {
    checkPocketBaseConnection(pocketbaseUrl, true);
  }, []);

  // Refresh collection list
  const refreshCollection = async () => {
    if (useDemoFallback) {
      // Just check connection again
      checkPocketBaseConnection(pocketbaseUrl);
    } else {
      setLoading(true);
      try {
        const res = await fetch(`${pocketbaseUrl}/api/collections/audiocd/records?sort=-created`);
        if (res.ok) {
          const data = await res.json();
          setCds(data.items || []);
        } else {
          setConnectionStatus('disconnected');
          setUseDemoFallback(true);
        }
      } catch (err) {
        setConnectionStatus('disconnected');
        setUseDemoFallback(true);
      } finally {
        setLoading(false);
      }
    }
  };

  // Compute stats based on current items displayed
  const stats = useMemo(() => {
    if (cds.length === 0) return { count: 0, avgCd: 0, avgCover: 0, totalValue: 0 };
    const count = cds.length;
    let totalCd = 0;
    let totalCover = 0;
    let totalValue = 0;
    
    cds.forEach(item => {
      totalCd += Number(item.cdcondition || 0);
      totalCover += Number(item.covercondition || 0);
      totalValue += Number(item.price || 0);
    });

    return {
      count,
      avgCd: Math.round((totalCd / count) * 10) / 10,
      avgCover: Math.round((totalCover / count) * 10) / 10,
      totalValue
    };
  }, [cds]);

  // Handle addition of a new CD
  const handleAddCD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!album.trim() || !author.trim()) {
      setFormStatus({ type: 'error', message: "Album title and Artist are required." });
      return;
    }

    setIsSubmitting(true);
    setFormStatus({ type: null, message: "" });

    // 1. Build local dummy or server object
    const newItemId = "cd_" + Math.random().toString(36).substr(2, 9);
    const currentDate = new Date().toISOString();

    const preparedItem: CDItem = {
      id: newItemId,
      collectionId: "pbc_386466699",
      collectionName: "audiocd",
      album: album.trim(),
      author: author.trim(),
      cdcondition,
      covercondition,
      price: price || "0",
      file: selectedFile ? [selectedFile.name] : [],
      created: currentDate,
      updated: currentDate
    };

    if (useDemoFallback) {
      // In demo mode, push to local state array
      setCds(prev => [preparedItem, ...prev]);
      setFormStatus({ type: 'success', message: "CD added to preview collection! (Demo Mode)" });
      resetForm();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setFormStatus({ type: null, message: "" });
      }, 1500);
      setIsSubmitting(false);
    } else {
      // Connect to real PocketBase using Multipart Form-Data
      const formData = new FormData();
      formData.append("album", album.trim());
      formData.append("author", author.trim());
      formData.append("cdcondition", String(cdcondition));
      formData.append("covercondition", String(covercondition));
      formData.append("price", price || "0");
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      try {
        const response = await fetch(`${pocketbaseUrl}/api/collections/audiocd/records`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const savedItem = await response.json();
          setCds(prev => [savedItem, ...prev]);
          setFormStatus({ type: 'success', message: "CD successfully saved to your PocketBase!" });
          resetForm();
          setTimeout(() => {
            setIsAddModalOpen(false);
            setFormStatus({ type: null, message: "" });
          }, 1500);
        } else {
          const errData = await response.json();
          setFormStatus({ type: 'error', message: errData.message || "Failed to save record to PocketBase." });
        }
      } catch (err) {
        setFormStatus({ type: 'error', message: "Could not connect to PocketBase. Verify server is running locally on port 8090." });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setAlbum("");
    setAuthor("");
    setCdcondition(8);
    setCovercondition(8);
    setPrice("");
    setSelectedFile(null);
  };

  // Delete CD (local state delete in demo mode, server-side delete in live mode)
  const handleDeleteCD = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this CD?")) {
      if (useDemoFallback) {
        setCds(prev => prev.filter(item => item.id !== id));
      } else {
        try {
          const res = await fetch(`${pocketbaseUrl}/api/collections/audiocd/records/${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setCds(prev => prev.filter(item => item.id !== id));
          } else {
            alert("Failed to delete record from PocketBase.");
          }
        } catch (err) {
          alert("Error connecting to PocketBase to delete.");
        }
      }
    }
  };

  // Filter and sort CDs list
  const filteredAndSortedCds = useMemo(() => {
    let result = [...cds];

    // Filter by search query (album or author)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.album.toLowerCase().includes(q) || 
        item.author.toLowerCase().includes(q)
      );
    }

    // Filter by min condition (the higher of the two, or just CD condition)
    if (minCondition > 0) {
      result = result.filter(item => item.cdcondition >= minCondition);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      // Handle numerical conversions for sorting
      if (sortBy === 'price') {
        valA = parseFloat(a.price) || 0;
        valB = parseFloat(b.price) || 0;
      } else if (sortBy === 'cdcondition' || sortBy === 'covercondition') {
        valA = Number(valA);
        valB = Number(valB);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cds, searchQuery, sortBy, sortOrder, minCondition]);

  const conditionColor = (rating: number) => {
    if (rating >= 9) return 'text-emerald-850 bg-emerald-50 border-emerald-200/80';
    if (rating >= 7) return 'text-stone-800 bg-stone-100 border-stone-200/80';
    if (rating >= 5) return 'text-amber-850 bg-amber-50 border-amber-200/80';
    return 'text-rose-850 bg-rose-50 border-rose-200/80';
  };

  const getConditionLabel = (rating: number) => {
    if (rating === 10) return "Mint (M)";
    if (rating === 9) return "Near Mint (NM)";
    if (rating >= 7) return "Very Good (VG)";
    if (rating >= 5) return "Good (G)";
    if (rating >= 3) return "Fair (F)";
    return "Poor (P)";
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans selection:bg-stone-200 selection:text-stone-850">
      
      {/* Banner indicating sandbox/demo status & how to connect */}
      <div className="bg-[#1C1A17] text-[#FAF8F5] border-b border-stone-800 px-4 py-3 text-xs md:text-sm tracking-wide">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-stone-300">
            <Info className="h-4 w-4 text-stone-400 flex-shrink-0" />
            <span>
              {connectionStatus === 'connected' ? (
                <span className="font-semibold text-emerald-400">⚡ Live Link Active:</span>
              ) : (
                <span className="font-semibold text-amber-400">💡 Browser IFrame Sandboxed:</span>
              )} Connected to PocketBase running on your device.
            </span>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex bg-stone-900 rounded-none p-1 border border-stone-700 w-full md:w-auto">
              <input 
                type="text" 
                value={pocketbaseUrl} 
                onChange={(e) => setPocketbaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8090"
                className="bg-transparent px-2 py-1 text-xs text-stone-300 placeholder-stone-600 focus:outline-none w-full md:w-44 font-mono"
              />
              <button 
                onClick={() => checkPocketBaseConnection(pocketbaseUrl)}
                disabled={isReconnecting}
                className="bg-stone-700 hover:bg-stone-600 text-white font-medium text-xs px-2.5 py-1 rounded-none transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                {isReconnecting ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Reconnect
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 bg-stone-800 border border-stone-700 px-2.5 py-1.5 rounded-none text-xs font-mono">
              <div className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-stone-400">{connectionStatus === 'connected' ? 'LIVE' : 'DEMO'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main App Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6 md:gap-8">
        
        {/* Navigation & Header */}
        <header className="flex flex-col justify-center items-center text-center gap-4 border-b-4 border-double border-stone-900 pb-6 pt-2">
          <div className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2">
            <span>COLLECTOR'S EDITION ARCHIVE</span>
            <span>•</span>
            <span>EST. 2026</span>
            <span>•</span>
            <span className="text-stone-800 font-bold bg-stone-200 px-1.5 py-0.5">V0.2</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-4xl md:text-6xl font-serif font-black tracking-tight text-stone-900 uppercase">
              The CD Journal
            </h1>
            <p className="text-stone-600 font-serif italic text-xs md:text-sm max-w-lg mt-1">
              A high-fidelity printed index and diagnostic dashboard for your physical compact disc library.
            </p>
          </div>
          
          {/* Thin divider line / information box */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-center border-t border-b border-stone-300 py-2.5 mt-2 text-xs text-stone-500 font-mono tracking-wider gap-3">
            <div className="flex items-center gap-2">
              <Disc className={`h-4 w-4 text-stone-800 ${connectionStatus === 'connected' ? 'animate-[spin_6s_linear_infinite]' : ''}`} />
              <span>FORMAT: COMPACT DISC (12CM)</span>
            </div>
            <div className="flex items-center gap-4">
              <span>COLLECTION ID: PBC_386466699</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-stone-900 font-semibold uppercase">{connectionStatus === 'connected' ? 'LIVE SYNCED' : 'SANDBOX FALLBACK'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-none border border-stone-300 w-full md:w-auto mt-2">
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${activeTab === 'collection' ? 'bg-[#1C1A17] text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'}`}
            >
              <Layers className="h-3.5 w-3.5" />
              CD Collection
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${activeTab === 'python' ? 'bg-[#1C1A17] text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'}`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Python Guide
            </button>
          </div>
        </header>

        {/* Tab content */}
        {activeTab === 'collection' && (
          <>
            {/* Stat Cards / Bento Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-4 border border-stone-300 bg-white divide-y lg:divide-y-0 lg:divide-x divide-stone-300">
              <div id="stat-total-cds" className="p-5 flex flex-col justify-between group bg-white">
                <div className="flex justify-between items-start">
                  <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Total Records</span>
                  <div className="text-stone-400 group-hover:text-stone-800 transition-colors">
                    <Music className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl md:text-4xl font-serif font-black tracking-tight text-stone-900">{stats.count}</div>
                  <p className="text-[10px] text-stone-500 mt-1 flex items-center gap-1 font-mono uppercase">
                    <Sparkles className="h-3 w-3 text-stone-400" />
                    <span>Physical discs index</span>
                  </p>
                </div>
              </div>

              <div id="stat-avg-condition" className="p-5 flex flex-col justify-between group bg-[#FAF8F5]">
                <div className="flex justify-between items-start">
                  <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Avg CD Grading</span>
                  <div className="text-stone-400 group-hover:text-stone-800 transition-colors">
                    <Disc className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl md:text-4xl font-serif font-black tracking-tight text-stone-900">
                    {stats.avgCd} <span className="text-xs md:text-sm text-stone-400 font-mono">/ 10</span>
                  </div>
                  <p className="text-[10px] text-stone-600 font-serif italic mt-1 font-semibold">
                    {getConditionLabel(Math.round(stats.avgCd))}
                  </p>
                </div>
              </div>

              <div id="stat-avg-cover" className="p-5 flex flex-col justify-between group bg-white">
                <div className="flex justify-between items-start">
                  <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Avg Cover Grading</span>
                  <div className="text-stone-400 group-hover:text-stone-800 transition-colors">
                    <BookOpen className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl md:text-4xl font-serif font-black tracking-tight text-stone-900">
                    {stats.avgCover} <span className="text-xs md:text-sm text-stone-400 font-mono">/ 10</span>
                  </div>
                  <p className="text-[10px] text-stone-600 font-serif italic mt-1 font-semibold">
                    {getConditionLabel(Math.round(stats.avgCover))}
                  </p>
                </div>
              </div>

              <div id="stat-total-value" className="p-5 flex flex-col justify-between group bg-[#FAF8F5]">
                <div className="flex justify-between items-start">
                  <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Portfolio Value</span>
                  <div className="text-stone-400 group-hover:text-stone-800 transition-colors">
                    <Coins className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl md:text-4xl font-serif font-black tracking-tight text-stone-900">
                    {stats.totalValue.toLocaleString()} <span className="text-xs md:text-sm text-stone-400 font-mono">PLN</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 flex items-center gap-1 font-mono uppercase">
                    <TrendingUp className="h-3 w-3 text-stone-400" />
                    <span>Market price estimate</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Utility Bar: Search, Sort & Filters */}
            <div className="border border-stone-300 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search album name or artist..."
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-none py-2 pl-10 pr-4 text-xs md:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 transition-colors font-sans"
                />
              </div>

              {/* Sorting & Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Min Grading quality */}
                <div className="flex items-center bg-white border border-stone-300 rounded-none px-3 py-1.5 gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-xs text-stone-500 font-mono uppercase tracking-wider">Min CD Rating:</span>
                  <select 
                    value={minCondition}
                    onChange={(e) => setMinCondition(Number(e.target.value))}
                    className="bg-transparent text-xs text-stone-950 font-semibold focus:outline-none cursor-pointer font-sans"
                  >
                    <option value={0} className="bg-white">Any</option>
                    <option value={5} className="bg-white">5+ Good</option>
                    <option value={7} className="bg-white">7+ Very Good</option>
                    <option value={9} className="bg-white">9+ Near Mint</option>
                  </select>
                </div>

                {/* Sorting drop-down */}
                <div className="flex items-center bg-white border border-stone-300 rounded-none px-3 py-1.5 gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-stone-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-xs text-stone-950 font-semibold focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="created" className="bg-white">Date Added</option>
                    <option value="album" className="bg-white">Album Title</option>
                    <option value="author" className="bg-white">Artist Name</option>
                    <option value="cdcondition" className="bg-white">CD Grading</option>
                    <option value="covercondition" className="bg-white">Cover Grading</option>
                    <option value="price" className="bg-white">Price</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-stone-800 hover:text-stone-950 font-mono text-xs font-semibold uppercase tracking-wider pl-1.5 border-l border-stone-300 cursor-pointer"
                  >
                    {sortOrder}
                  </button>
                </div>

                {/* Add CD Trigger */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs md:text-sm px-5 py-2 rounded-none transition-all flex items-center gap-2 uppercase tracking-wider border border-stone-900 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add CD</span>
                </button>
              </div>
            </div>

            {/* List Results Grid */}
            {filteredAndSortedCds.length === 0 ? (
              <div className="bg-white border border-stone-300 rounded-none p-12 text-center flex flex-col items-center justify-center gap-3">
                <Disc className="h-10 w-10 text-stone-400 animate-spin" style={{ animationDuration: '20s' }} />
                <h3 className="text-lg font-serif font-bold text-stone-950 mt-2">No audio CDs found</h3>
                <p className="text-stone-600 text-xs md:text-sm max-w-sm font-sans">
                  {searchQuery ? "No records match your search query and filters." : "Your collection is currently empty. Connect your PocketBase or click 'Add CD' to insert items!"}
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(""); setMinCondition(0); }} 
                    className="mt-2 text-xs text-stone-800 hover:text-stone-950 font-semibold underline underline-offset-4 cursor-pointer"
                  >
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {filteredAndSortedCds.map((item) => {
                  // Determine cover art
                  const hasCoverFile = item.file && item.file.length > 0;
                  const coverUrl = hasCoverFile && !useDemoFallback
                    ? `${pocketbaseUrl}/api/files/${item.collectionId}/${item.id}/${item.file[0]}`
                    : null;

                  return (
                    <div 
                      key={item.id}
                      className="group relative bg-white border border-stone-300 rounded-none p-5 flex flex-col justify-between hover:border-stone-950 hover:shadow-lg transition-all duration-300"
                    >
                      {/* Floating Price Badge */}
                      <div className="absolute top-4 right-4 z-20 bg-stone-100 border border-stone-300 text-stone-900 font-mono font-bold text-xs px-2.5 py-1 rounded-none">
                        {item.price} PLN
                      </div>

                      {/* Sliding Disc Jewel Case Cover */}
                      <div className="relative aspect-[4/3] w-full bg-[#FAF8F5] rounded-none overflow-hidden mb-4 border border-stone-200 shadow-inner flex items-center justify-center">
                        
                        {/* CD Tray/Holder (behind sleeve) */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-stone-300 bg-stone-100 flex items-center justify-center shadow-md transform translate-x-2 opacity-50 group-hover:translate-x-6 group-hover:opacity-100 transition-all duration-700">
                          {/* Inner Vinyl Groove */}
                          <div className="w-36 h-36 rounded-full border border-stone-300 bg-stone-200 flex items-center justify-center relative shadow-inner animate-[spin_12s_linear_infinite]">
                            <div className="absolute inset-2 rounded-full border border-stone-300" />
                            <div className="absolute inset-5 rounded-full border border-stone-300" />
                            <div className="absolute inset-8 rounded-full border border-stone-300" />
                            <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center">
                              <div className="w-4 h-4 rounded-full bg-stone-300 border border-stone-400" />
                            </div>
                          </div>
                        </div>

                        {/* Front Sleeve Album Cover (slides out slightly or shrinks back) */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-3/4 z-10 shadow-2xl transition-transform duration-500 ease-out group-hover:scale-[0.98] group-hover:translate-x-1"
                          style={{
                            background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : getCoverGradient(item.album, item.author)
                          }}
                        >
                          {/* Glossy overlay sheen */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 mix-blend-overlay" />
                          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-r from-black/40 to-transparent" />
                          
                          {/* Sleeve Text when no image is loaded */}
                          {!coverUrl && (
                            <div className="absolute inset-0 p-4 flex flex-col justify-between text-stone-900 bg-[#EFECE6] border-r border-stone-300">
                              <div className="flex items-start justify-between">
                                <Disc className="h-5 w-5 text-stone-700 opacity-80" />
                                <span className="text-[9px] font-mono tracking-widest text-stone-500 uppercase bg-stone-200/60 px-1.5 py-0.5 rounded-none">CD FORMAT</span>
                              </div>
                              <div className="border-t border-stone-400 pt-3">
                                <h4 className="font-serif font-black text-sm leading-tight tracking-tight text-stone-950 uppercase line-clamp-2">{item.album}</h4>
                                <p className="font-serif italic text-[11px] text-stone-700 mt-1 tracking-wide font-medium capitalize">{item.author}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item details */}
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="font-serif font-black text-stone-900 group-hover:text-stone-950 capitalize text-base tracking-tight truncate line-clamp-1">{item.album}</h3>
                          <p className="text-stone-500 font-serif italic text-xs capitalize mt-0.5 tracking-wide truncate">{item.author}</p>
                        </div>

                        {/* Grading Condition Blocks */}
                        <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                          <div className="bg-[#FAF8F5] border border-stone-200 rounded-none p-2 flex flex-col justify-between">
                            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">CD Disc</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-sm font-serif font-black text-stone-950">{item.cdcondition}</span>
                              <span className="text-[10px] text-stone-400 font-mono">/10</span>
                            </div>
                            <span className={`text-[9px] font-semibold mt-1 inline-block border px-1.5 py-0.5 rounded-none text-center ${conditionColor(item.cdcondition)}`}>
                              {getConditionLabel(item.cdcondition)}
                            </span>
                          </div>

                          <div className="bg-[#FAF8F5] border border-stone-200 rounded-none p-2 flex flex-col justify-between">
                            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">Sleeve/Cover</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-sm font-serif font-black text-stone-950">{item.covercondition}</span>
                              <span className="text-[10px] text-slate-400 font-mono">/10</span>
                            </div>
                            <span className={`text-[9px] font-semibold mt-1 inline-block border px-1.5 py-0.5 rounded-none text-center ${conditionColor(item.covercondition)}`}>
                              {getConditionLabel(item.covercondition)}
                            </span>
                          </div>
                        </div>

                        {/* Date Added and Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-stone-200 text-[11px] text-stone-400 font-mono tracking-wider uppercase">
                          <span>ADDED {new Date(item.created).toLocaleDateString()}</span>
                          
                          <button
                            onClick={() => handleDeleteCD(item.id)}
                            className="text-stone-400 hover:text-stone-800 p-1 transition-colors cursor-pointer"
                            title="Delete CD from index"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'python' && (
          <section className="bg-white border border-stone-300 p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-300 pb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-serif font-black text-stone-900 flex items-center gap-2">
                  <span>🐍</span>
                  <span>Pure Python CD Collection App</span>
                </h2>
                <p className="text-stone-600 text-xs md:text-sm mt-1 font-serif italic">
                  We have preloaded a fully functional Flask web server in your project workspace. This script connects natively to your PocketBase and serves a styled HTML view!
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#FAF8F5] px-3 py-1.5 rounded-none border border-stone-300 text-stone-700 font-mono">app.py</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              
              {/* How to run instructions */}
              <div className="lg:col-span-1 flex flex-col gap-5">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm md:text-base mb-2 font-serif">How to Run Locally:</h3>
                  <ol className="text-xs md:text-sm text-stone-700 flex flex-col gap-3.5 list-decimal pl-5 font-sans">
                    <li>
                      <p className="font-semibold text-stone-900">Ensure PocketBase is running:</p>
                      <code className="block bg-[#FAF8F5] border border-stone-300 rounded-none px-2.5 py-1.5 mt-1 text-amber-850 font-mono">./pocketbase serve</code>
                    </li>
                    <li>
                      <p className="font-semibold text-stone-900">Export your code:</p>
                      <span className="text-stone-600">Download this project ZIP from the top right settings wheel in AI Studio.</span>
                    </li>
                    <li>
                      <p className="font-semibold text-stone-900">Install dependencies:</p>
                      <code className="block bg-[#FAF8F5] border border-stone-300 rounded-none px-2.5 py-1.5 mt-1 text-stone-850 font-mono">pip install Flask requests</code>
                    </li>
                    <li>
                      <p className="font-semibold text-stone-900">Run the Python web app:</p>
                      <code className="block bg-[#FAF8F5] border border-stone-300 rounded-none px-2.5 py-1.5 mt-1 text-stone-850 font-mono">python app.py</code>
                    </li>
                    <li>
                      <p className="font-semibold text-stone-900">Open in browser:</p>
                      <span className="text-stone-600">Navigate to <code className="text-stone-900 font-mono font-semibold">http://localhost:5000</code> to view, search, and manage your CDs!</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-[#FAF8F5] border border-stone-300 p-4 flex flex-col gap-2 mt-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5 text-stone-700" />
                    <span>Python & PocketBase SDK Note</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-stone-600 font-sans">
                    Your Python script has been written to make use of the standard, secure, and fast HTTP API interface. This minimizes dependencies and guarantees instant cross-platform compatibility!
                  </p>
                </div>
              </div>

              {/* Code Preview block */}
              <div className="lg:col-span-2 bg-[#1C1A17] border border-stone-800 rounded-none overflow-hidden flex flex-col">
                <div className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-stone-700" />
                    <div className="h-2.5 w-2.5 rounded-full bg-stone-700" />
                    <div className="h-2.5 w-2.5 rounded-full bg-stone-700" />
                  </div>
                  <span className="text-xs font-mono text-stone-400 font-bold">Python App Core Code</span>
                </div>
                <div className="p-4 overflow-y-auto max-h-[380px] font-mono text-xs text-stone-300 leading-relaxed bg-[#1C1A17]">
                  <pre className="text-emerald-400"># app.py - Standard Flask Server</pre>
                  <pre className="text-stone-400">from flask import Flask, render_template_string, request, redirect, url_for</pre>
                  <pre className="text-stone-400">import requests</pre>
                  <pre className="text-stone-400">import os</pre>
                  <br />
                  <pre className="text-stone-400 font-semibold text-stone-200">app = Flask(__name__)</pre>
                  <pre className="text-yellow-400">POCKETBASE_URL = "http://localhost:8090"</pre>
                  <pre className="text-yellow-400">COLLECTION_NAME = "audiocd"</pre>
                  <br />
                  <pre className="text-stone-400 italic"># Index Route to display items and search</pre>
                  <pre className="text-stone-400">@app.route("/", methods=["GET"])</pre>
                  <pre className="text-stone-400">def index():</pre>
                  <pre className="text-stone-400">    search_query = request.args.get("q", "").strip()</pre>
                  <pre className="text-stone-400">    try:</pre>
                  <pre className="text-stone-400">        # Fetch CDs from PocketBase</pre>
                  <pre className="text-stone-400 font-semibold text-stone-200">        url = f"&#123;POCKETBASE_URL&#125;/api/collections/&#123;COLLECTION_NAME&#125;/records?sort=-created"</pre>
                  <pre className="text-stone-400">        resp = requests.get(url, timeout=2.0)</pre>
                  <pre className="text-stone-400">        data = resp.json()</pre>
                  <pre className="text-stone-400">        items = data.get("items", [])</pre>
                  <pre className="text-stone-400">    except Exception as e:</pre>
                  <pre className="text-stone-400">        items = []  # Fallback</pre>
                  <br />
                  <pre className="text-stone-400 italic">    # Render dynamic web dashboard ...</pre>
                  <pre className="text-stone-400">    return render_template(items, search_query)</pre>
                </div>
                <div className="bg-stone-900 border-t border-stone-800 p-3 text-center text-xs text-stone-400 font-mono">
                  The complete implementation is detailed in <code className="text-stone-200 font-semibold font-mono">app.py</code> in the file explorer!
                </div>
              </div>

            </div>
          </section>
        )}

      </div>

      {/* Add CD Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-double border-stone-900 max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#FAF8F5] border-b border-stone-300 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc className="h-5 w-5 text-stone-900" />
                <h2 className="text-lg font-serif font-black text-stone-900 uppercase tracking-tight">Add CD to Journal</h2>
              </div>
              <button 
                onClick={() => { setIsAddModalOpen(false); setFormStatus({ type: null, message: "" }); }}
                className="text-stone-400 hover:text-stone-900 font-bold hover:bg-stone-100 px-2.5 py-1.5 rounded-none text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCD} className="p-6 flex flex-col gap-4 font-sans">
              {formStatus.type && (
                <div className={`p-3 border text-xs font-semibold rounded-none ${formStatus.type === 'success' ? 'bg-[#EFECE6] border-stone-400 text-stone-900' : 'bg-red-550 border-red-800 text-stone-900 bg-red-50'}`}>
                  {formStatus.message}
                </div>
              )}

              {/* Form Input fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">Album Title *</label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="e.g. dziwki dragi"
                    required
                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-none px-3.5 py-2 text-xs md:text-sm text-stone-900 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">Artist / Author *</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. rogal ddl"
                    required
                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-none px-3.5 py-2 text-xs md:text-sm text-stone-900 focus:outline-none focus:border-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">CD Condition (1-10)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={cdcondition}
                      onChange={(e) => setCdcondition(Number(e.target.value))}
                      className="w-full h-1 bg-stone-300 rounded-none appearance-none cursor-pointer accent-stone-900"
                    />
                    <span className="text-sm font-bold font-serif text-stone-950 min-w-[20px]">{cdcondition}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">Cover Condition (1-10)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={covercondition}
                      onChange={(e) => setCovercondition(Number(e.target.value))}
                      className="w-full h-1 bg-stone-300 rounded-none appearance-none cursor-pointer accent-stone-900"
                    />
                    <span className="text-sm font-bold font-serif text-stone-950 min-w-[20px]">{covercondition}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">Price (PLN)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-none px-3.5 py-2 text-xs md:text-sm text-stone-900 focus:outline-none focus:border-stone-900 transition-colors font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-stone-700 text-xs font-mono uppercase tracking-wider mb-1.5">Cover File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-none px-3.5 py-2 text-xs text-stone-600 focus:outline-none focus:border-stone-900 file:mr-4 file:py-1 file:px-3 file:rounded-none file:border file:border-stone-400 file:text-xs file:font-mono file:bg-white file:text-stone-800 hover:file:bg-stone-50 transition-colors"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">If using Demo mode, files cannot be fetched dynamically from local disk but are recorded in list structure.</p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 mt-4 border-t border-stone-300 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setFormStatus({ type: null, message: "" }); }}
                  className="bg-white border border-stone-300 text-stone-700 font-semibold text-xs md:text-sm px-4 py-2.5 rounded-none hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs md:text-sm px-6 py-2.5 rounded-none transition-all flex items-center gap-2 uppercase tracking-wider border border-stone-900 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add to Collection</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 border-t border-stone-850 py-6 px-4 text-center text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span>CD JOURNAL COLLECTION MANAGEMENT SYSTEM • EST. 2026</span>
          <span className="text-stone-500">Configured to poll local dev-server at http://127.0.0.1:8090</span>
        </div>
      </footer>

    </div>
  );
}
