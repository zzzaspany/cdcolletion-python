#!/usr/bin/env python3
"""
CD Vault - PocketBase Python Sync Web Application
Author: AI Studio Assistant

Dependencies:
    pip install Flask requests

Usage:
    python app.py
"""

import os
import sys
import uuid
import datetime
from flask import Flask, render_template_string, request, redirect, url_for, flash

try:
    import requests
except ImportError:
    print("Error: 'requests' package not installed.", file=sys.stderr)
    print("Please run: pip install requests", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
# Standard secret key for session-based flash notifications
app.secret_key = "cd_vault_python_secure_secret"

# Local PocketBase configurations matched to your local device server
POCKETBASE_URL = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090")
COLLECTION_NAME = "audiocd"

# Smart caching and dynamic resolution of internal PocketBase container networking
_cached_internal_url = None

def clear_pocketbase_cache():
    global _cached_internal_url
    _cached_internal_url = None

def get_pocketbase_internal_url():
    global _cached_internal_url
    if _cached_internal_url is not None:
        return _cached_internal_url
    
    # Check explicit internal URL environment variable override first
    env_internal = os.environ.get("POCKETBASE_INTERNAL_URL")
    if env_internal:
        print(f"[PocketBase Network] Using explicit POCKETBASE_INTERNAL_URL: {env_internal}")
        _cached_internal_url = env_internal
        return env_internal

    from urllib.parse import urlparse
    try:
        parsed = urlparse(POCKETBASE_URL)
        port = parsed.port or 8090
    except Exception:
        port = 8090
    
    # Candidate internal connection URLs for Docker/Podman same-network container resolution
    candidates = [
        POCKETBASE_URL,
        f"http://pocketbase:{port}",
        f"http://pocketbase-server:{port}",
        f"http://host.docker.internal:{port}",
        f"http://172.17.0.1:{port}",
        f"http://127.0.0.1:{port}"
    ]
    
    # Deduplicate candidates while preserving order
    seen = set()
    dedup_candidates = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            dedup_candidates.append(c)
            
    print(f"[PocketBase Network] Probing candidates for internal resolution: {dedup_candidates}")
    for url in dedup_candidates:
        probe_urls = [
            f"{url}/api/collections/{COLLECTION_NAME}/records?perPage=1",
            f"{url}/api/health"
        ]
        for probe_url in probe_urls:
            try:
                # Use a larger 1.5s timeout for network & DNS resolution in container environments
                print(f"[PocketBase Network] Probing {probe_url} ...")
                response = requests.get(probe_url, timeout=1.5)
                # Any response status of 200, 400, 403, or 404 indicates a running server responded
                if response.status_code in [200, 204, 400, 403, 404]:
                    print(f"[PocketBase Network] Success! Connected internally to: {url} (status: {response.status_code})")
                    _cached_internal_url = url
                    return url
                else:
                    print(f"[PocketBase Network] Connected to {url} but got unexpected status: {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"[PocketBase Network] Probe to {probe_url} failed: {e}")
            
    # Fallback to standard POCKETBASE_URL if no connection probe is successful
    print(f"[PocketBase Network] No probes succeeded. Falling back to POCKETBASE_URL: {POCKETBASE_URL}")
    _cached_internal_url = POCKETBASE_URL
    return POCKETBASE_URL

@app.route("/api/files/<collection_id>/<record_id>/<filename>", methods=["GET"])
def proxy_pb_file(collection_id, record_id, filename):
    internal_url = get_pocketbase_internal_url()
    pb_file_url = f"{internal_url}/api/files/{collection_id}/{record_id}/{filename}"
    try:
        response = requests.get(pb_file_url, stream=True, timeout=5.0)
        from flask import Response
        headers = {}
        if "Content-Type" in response.headers:
            headers["Content-Type"] = response.headers["Content-Type"]
        if "Content-Length" in response.headers:
            headers["Content-Length"] = response.headers["Content-Length"]
            
        def generate():
            for chunk in response.iter_content(chunk_size=4096):
                yield chunk
                
        return Response(generate(), status=response.status_code, headers=headers)
    except Exception as e:
        print(f"[PocketBase File Proxy Error] Failed to proxy file {filename}: {e}")
        return "File not found or pocketbase offline", 404

# High-fidelity offline demo items in case PocketBase is offline or empty initially
FALLBACK_ITEMS = [
    {
        "id": "rogalddldziwki1",
        "collectionId": "pbc_386466699",
        "collectionName": "audiocd",
        "album": "dziwki dragi",
        "author": "rogal ddl",
        "cdcondition": 7,
        "covercondition": 6,
        "price": "120",
        "file": ["4893993211067_wbo037jmba.jpg"],
        "created": "2026-07-11 21:53:30.554Z",
        "updated": "2026-07-11 21:53:30.554Z"
    },
    {
        "id": "pezetnoonmuzyka",
        "collectionId": "pbc_386466699",
        "collectionName": "audiocd",
        "album": "Muzyka Klasyczna",
        "author": "Pezet-Noon",
        "cdcondition": 9,
        "covercondition": 8,
        "price": "320",
        "file": [],
        "created": "2026-07-11 20:10:15.000Z",
        "updated": "2026-07-11 20:10:15.000Z"
    },
    {
        "id": "nirvananevermind",
        "collectionId": "pbc_386466699",
        "collectionName": "audiocd",
        "album": "Nevermind",
        "author": "Nirvana",
        "cdcondition": 8,
        "covercondition": 7,
        "price": "95",
        "file": [],
        "created": "2026-07-11 18:42:00.000Z",
        "updated": "2026-07-11 18:42:00.000Z"
    },
    {
        "id": "pinkfloyddark",
        "collectionId": "pbc_386466699",
        "collectionName": "audiocd",
        "album": "The Dark Side of the Moon",
        "author": "Pink Floyd",
        "cdcondition": 10,
        "covercondition": 9,
        "price": "150",
        "file": [],
        "created": "2026-07-11 15:30:22.000Z",
        "updated": "2026-07-11 15:30:22.000Z"
    }
]

def get_gradient_style(title, author_name):
    """Generates a unique, stable visual gradient background based on album title hash"""
    combined = f"{title} {author_name}"
    hash_val = sum(ord(c) for c in combined)
    h1 = abs(hash_val) % 360
    h2 = (h1 + 130) % 360
    return f"background: linear-gradient(135deg, hsl({h1}, 75%, 35%) 0%, hsl({h2}, 85%, 15%) 100%)"

def get_condition_label(rating):
    """Translates numerical condition ratings to standard Goldmine grading scale"""
    if rating == 10: return "Mint (M)"
    if rating == 9: return "Near Mint (NM)"
    if rating >= 7: return "Very Good (VG)"
    if rating >= 5: return "Good (G)"
    if rating >= 3: return "Fair (F)"
    return "Poor (P)"

def get_condition_color(rating):
    """Provides Tailwind CSS class pairs matching quality levels"""
    if rating >= 9: return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    if rating >= 7: return "text-teal-400 bg-teal-500/10 border-teal-500/20"
    if rating >= 5: return "text-amber-400 bg-amber-500/10 border-amber-500/20"
    return "text-rose-400 bg-rose-500/10 border-rose-500/20"

# Inject helper functions directly into the Jinja template rendering environment
app.jinja_env.globals.update(
    get_gradient_style=get_gradient_style,
    get_condition_label=get_condition_label,
    get_condition_color=get_condition_color
)

# Responsive, high-fidelity HTML and Tailwind dashboard matching our React frontend
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CD Vault - Python PocketBase Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
        body { font-family: 'Space Grotesk', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
    
    <!-- Top connection status banner -->
    <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/20 px-4 py-3 text-xs md:text-sm">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-indigo-200">
                <svg class="h-4 w-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                    {% if connected %}
                        <span class="font-semibold text-emerald-400">⚡ Live Link Active:</span> PocketBase connected on <strong class="font-mono text-xs">{{ pb_url }}</strong>
                    {% else %}
                        <span class="font-semibold text-amber-400">💡 Running in Sandbox Mode:</span> Local PocketBase offline at <strong class="font-mono text-xs">{{ pb_url }}</strong>. Using in-memory database.
                    {% endif %}
                </span>
            </div>
            <div class="flex items-center gap-1.5 bg-slate-950/40 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                <div class="h-2 w-2 rounded-full {% if connected %}bg-emerald-500 animate-pulse{% else %}bg-amber-500{% endif %}"></div>
                <span class="text-slate-400">{% if connected %}LIVE{% else %}DEMO{% endif %}</span>
            </div>
        </div>
    </div>

    <!-- Main Wrapper -->
    <div class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6 md:gap-8">
        
        <!-- Dashboard Header -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
            <div class="flex items-center gap-4">
                <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-full relative shadow-inner">
                    <svg class="h-8 w-8 text-indigo-400 animate-[spin_10s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke-width="2" />
                        <circle cx="12" cy="12" r="3" stroke-width="2" />
                        <path d="M12 2a10 10 0 0110 10" stroke-width="2" />
                    </svg>
                </div>
                <div class="flex items-center gap-2">
                    <h1 class="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">CD Vault</h1>
                    <span class="text-[10px] font-mono font-semibold tracking-wider text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">v0.2</span>
                </div>
            </div>

            <div>
                <button onclick="document.getElementById('add-modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs md:text-sm px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/15">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                    <span>Add CD</span>
                </button>
            </div>
        </header>

        <!-- Bento Stats Grid -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col justify-between group hover:border-slate-800 transition-all">
                <span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Total Records</span>
                <div class="mt-4">
                    <div class="text-2xl md:text-3xl font-bold font-mono text-white">{{ stats.count }}</div>
                    <p class="text-[10px] md:text-xs text-indigo-400/80 mt-1">Physical CD indexes</p>
                </div>
            </div>
            
            <div class="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col justify-between group hover:border-slate-800 transition-all">
                <span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Avg Disc Grading</span>
                <div class="mt-4">
                    <div class="text-2xl md:text-3xl font-bold font-mono text-white">{{ stats.avg_cd }} <span class="text-xs text-slate-500">/ 10</span></div>
                    <p class="text-[10px] md:text-xs text-emerald-400/80 mt-1">{{ get_condition_label(stats.avg_cd|round|int) }}</p>
                </div>
            </div>

            <div class="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col justify-between group hover:border-slate-800 transition-all">
                <span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Avg Cover Grading</span>
                <div class="mt-4">
                    <div class="text-2xl md:text-3xl font-bold font-mono text-white">{{ stats.avg_cover }} <span class="text-xs text-slate-500">/ 10</span></div>
                    <p class="text-[10px] md:text-xs text-teal-400/80 mt-1">{{ get_condition_label(stats.avg_cover|round|int) }}</p>
                </div>
            </div>

            <div class="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col justify-between group hover:border-slate-800 transition-all">
                <span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Est. Value</span>
                <div class="mt-4">
                    <div class="text-2xl md:text-3xl font-bold font-mono text-white">{{ stats.total_value }} <span class="text-xs text-slate-500">PLN</span></div>
                    <p class="text-[10px] md:text-xs text-amber-400/80 mt-1">Based on album price tags</p>
                </div>
            </div>
        </section>

        <!-- Utility Bar & Search Form -->
        <div class="bg-slate-900/30 border border-slate-900/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <form action="/" method="GET" class="relative flex-1 max-w-md w-full flex gap-2">
                <div class="relative flex-1">
                    <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        name="q"
                        value="{{ search_query }}"
                        placeholder="Search by album name or artist/author..."
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                </div>
                <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow shadow-indigo-600/10">
                    Search
                </button>
            </form>
            
            {% if search_query %}
            <div>
                <a href="/" class="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4">Reset search query filter</a>
            </div>
            {% endif %}
        </div>

        <!-- Session Message Flashers -->
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="p-3.5 rounded-xl border text-xs font-semibold {% if category == 'success' %}bg-emerald-500/10 border-emerald-500/20 text-emerald-400{% else %}bg-rose-500/10 border-rose-500/20 text-rose-400{% endif %} animate-pulse">
                        {{ message }}
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <!-- CD Jewel Cards List -->
        {% if items|length == 0 %}
            <div class="bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <svg class="h-10 w-10 text-slate-700 animate-spin" style="animation-duration: 15s" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-dasharray="4 4" stroke-width="2" />
                </svg>
                <h3 class="text-lg font-semibold text-slate-300 mt-2">No matching CDs found</h3>
                <p class="text-slate-500 text-xs md:text-sm">Click 'Add CD' to begin indexing your items.</p>
            </div>
        {% else %}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {% for item in items %}
                    {% set has_cover = item.file and item.file|length > 0 %}
                    <div class="group relative bg-slate-900/35 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between hover:bg-slate-900/60 hover:border-slate-800 transition-all duration-500 hover:shadow-xl hover:shadow-black/20">
                        
                        <!-- Value Badge -->
                        <div class="absolute top-3 right-3 z-20 bg-slate-950/80 border border-slate-800 text-indigo-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full backdrop-blur">
                            {{ item.price }} PLN
                        </div>

                        <!-- Jewel Case Slide-out Disc -->
                        <div class="relative aspect-[4/3] w-full bg-slate-950 rounded-xl overflow-hidden mb-4 border border-slate-800/80 shadow-inner flex items-center justify-center">
                            
                            <!-- Plastic CD Disc Core -->
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center shadow-lg transform translate-x-2 opacity-50 group-hover:translate-x-6 group-hover:opacity-100 transition-all duration-700">
                                <div class="w-36 h-36 rounded-full border border-slate-900/50 bg-slate-900 flex items-center justify-center relative shadow-inner animate-[spin_12s_linear_infinite]">
                                    <div class="absolute inset-2 rounded-full border border-slate-800/30"></div>
                                    <div class="absolute inset-5 rounded-full border border-slate-800/30"></div>
                                    <div class="absolute inset-8 rounded-full border border-slate-800/30"></div>
                                    <div class="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-400/10 flex items-center justify-center">
                                        <div class="w-4 h-4 rounded-full bg-slate-950 border border-slate-800"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Front Sleeve / Art Cover -->
                            {% if has_cover and connected %}
                                <div class="absolute left-0 top-0 bottom-0 w-3/4 z-10 shadow-2xl transition-transform duration-500 ease-out group-hover:scale-[0.98] group-hover:translate-x-1" 
                                     style="background: url('/api/files/{{ item.collectionId }}/{{ item.id }}/{{ item.file[0] }}') center/cover no-repeat">
                                    <div class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 mix-blend-overlay"></div>
                                    <div class="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-r from-black/40 to-transparent"></div>
                                </div>
                            {% else %}
                                <div class="absolute left-0 top-0 bottom-0 w-3/4 z-10 shadow-2xl transition-transform duration-500 ease-out group-hover:scale-[0.98] group-hover:translate-x-1 flex flex-col justify-between p-4" 
                                     style="{{ get_gradient_style(item.album, item.author) }}">
                                    <div class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 mix-blend-overlay"></div>
                                    <div class="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-r from-black/40 to-transparent"></div>
                                    <div class="flex items-start justify-between">
                                        <svg class="h-5 w-5 text-indigo-300 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                                        <span class="text-[9px] font-mono tracking-widest text-slate-400 uppercase bg-black/30 px-1.5 py-0.5 rounded">CD FORMAT</span>
                                    </div>
                                    <div class="z-10">
                                        <h4 class="font-bold text-sm leading-tight tracking-tight text-white drop-shadow capitalize line-clamp-2">{{ item.album }}</h4>
                                        <p class="text-[10px] text-slate-300 drop-shadow mt-1 tracking-wide font-medium capitalize">{{ item.author }}</p>
                                    </div>
                                </div>
                            {% endif %}
                        </div>

                        <!-- Detail cards specifications -->
                        <div class="flex flex-col gap-3">
                            <div>
                                <h3 class="font-bold text-slate-100 group-hover:text-white capitalize text-base truncate">{{ item.album }}</h3>
                                <p class="text-slate-400 text-xs capitalize mt-0.5 tracking-wide truncate">{{ item.author }}</p>
                            </div>

                            <div class="grid grid-cols-2 gap-2 pt-1">
                                <div class="bg-slate-950/40 border border-slate-900 rounded-lg p-2 flex flex-col justify-between">
                                    <span class="text-[10px] font-semibold text-slate-500 uppercase">CD Disc</span>
                                    <div class="flex items-baseline gap-1.5 mt-1">
                                        <span class="text-sm font-bold text-slate-200">{{ item.cdcondition }}</span>
                                        <span class="text-[10px] text-slate-500 font-semibold font-mono">/10</span>
                                    </div>
                                    <span class="text-[9px] font-semibold mt-1 inline-block border px-1.5 py-0.5 rounded-md text-center {{ get_condition_color(item.cdcondition|int) }}">
                                        {{ get_condition_label(item.cdcondition|int) }}
                                    </span>
                                </div>

                                <div class="bg-slate-950/40 border border-slate-900 rounded-lg p-2 flex flex-col justify-between">
                                    <span class="text-[10px] font-semibold text-slate-500 uppercase">Sleeve/Cover</span>
                                    <div class="flex items-baseline gap-1.5 mt-1">
                                        <span class="text-sm font-bold text-slate-200">{{ item.covercondition }}</span>
                                        <span class="text-[10px] text-slate-500 font-semibold font-mono">/10</span>
                                    </div>
                                    <span class="text-[9px] font-semibold mt-1 inline-block border px-1.5 py-0.5 rounded-md text-center {{ get_condition_color(item.covercondition|int) }}">
                                        {{ get_condition_label(item.covercondition|int) }}
                                    </span>
                                </div>
                            </div>

                            <!-- Footer control links -->
                            <div class="flex items-center justify-between pt-3 border-t border-slate-900 text-[11px] text-slate-500">
                                <span>ID: <code class="text-indigo-400 font-mono">{{ item.id[:8] }}</code></span>
                                <a href="/delete/{{ item.id }}" onclick="return confirm('Remove CD from collection?')" class="text-slate-600 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors">
                                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </a>
                            </div>
                        </div>

                    </div>
                {% endfor %}
            </div>
        {% endif %}
    </div>

    <!-- Modal Form overlay -->
    <div id="add-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 hidden animate-in fade-in duration-200">
        <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div class="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <svg class="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke-width="2"/></svg>
                    <h2 class="text-lg font-bold text-white">Add CD to Vault</h2>
                </div>
                <button onclick="document.getElementById('add-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-200 px-2 rounded-lg text-sm font-semibold">✕</button>
            </div>

            <form action="/add" method="POST" enctype="multipart/form-data" class="p-6 flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">Album Title *</label>
                        <input type="text" name="album" placeholder="e.g. dziwki dragi" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                    </div>

                    <div class="col-span-2">
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">Artist / Author *</label>
                        <input type="text" name="author" placeholder="e.g. rogal ddl" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                    </div>

                    <div>
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">CD Condition (1-10)</label>
                        <input type="number" name="cdcondition" min="1" max="10" value="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                    </div>

                    <div>
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">Cover Condition (1-10)</label>
                        <input type="number" name="covercondition" min="1" max="10" value="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                    </div>

                    <div class="col-span-2">
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">Price (PLN)</label>
                        <input type="number" name="price" placeholder="e.g. 120" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono" />
                    </div>

                    <div class="col-span-2">
                        <label class="block text-slate-400 text-xs font-bold uppercase mb-1.5">Cover Image File</label>
                        <input type="file" name="file" accept="image/*" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400" />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 mt-4 border-t border-slate-800 pt-4">
                    <button type="button" onclick="document.getElementById('add-modal').classList.add('hidden')" class="bg-slate-950 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-medium">Cancel</button>
                    <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-medium shadow-md shadow-indigo-600/15">Save CD</button>
                </div>
            </form>
        </div>
    </div>

</body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    search_query = request.args.get("q", "").strip()
    connected = False
    items = []

    internal_url = get_pocketbase_internal_url()
    try:
        # Fetch actual live data from local PocketBase
        url = f"{internal_url}/api/collections/{COLLECTION_NAME}/records?sort=-created"
        response = requests.get(url, timeout=1.0)
        if response.status_code == 200:
            connected = True
            items = response.json().get("items", [])
        else:
            print(f"[PocketBase Index Error] Fetch from {url} returned status {response.status_code}: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"[PocketBase Index Error] Failed to fetch items from {internal_url}: {e}")
        connected = False
        clear_pocketbase_cache()

    # Gracefully fall back to local offline items if disconnected
    if not connected:
        items = FALLBACK_ITEMS

    # Handle searching query parameters
    if search_query:
        q_lower = search_query.lower()
        items = [
            item for item in items 
            if q_lower in item.get("album", "").lower() or q_lower in item.get("author", "").lower()
        ]

    # Calculate collection metrics
    stats = {
        "count": len(items),
        "avg_cd": 0.0,
        "avg_cover": 0.0,
        "total_value": 0
    }
    
    if items:
        total_cd = sum(int(item.get("cdcondition", 0)) for item in items)
        total_cover = sum(int(item.get("covercondition", 0)) for item in items)
        total_value = sum(int(float(item.get("price", "0") or "0")) for item in items)
        stats["avg_cd"] = round(total_cd / len(items), 1)
        stats["avg_cover"] = round(total_cover / len(items), 1)
        stats["total_value"] = total_value

    return render_template_string(
        HTML_TEMPLATE, 
        items=items, 
        search_query=search_query, 
        connected=connected, 
        pb_url=POCKETBASE_URL, 
        stats=stats
    )


@app.route("/add", methods=["POST"])
def add_cd():
    album = request.form.get("album", "").strip()
    author = request.form.get("author", "").strip()
    cd_cond = request.form.get("cdcondition", "8").strip()
    cover_cond = request.form.get("covercondition", "8").strip()
    price = request.form.get("price", "0").strip()
    
    file_upload = request.files.get("file")

    internal_url = get_pocketbase_internal_url()
    try:
        # Forward the multipart payload straight into your local PocketBase instance
        payload = {
            "album": album,
            "author": author,
            "cdcondition": cd_cond,
            "covercondition": cover_cond,
            "price": price
        }
        
        files = None
        if file_upload and file_upload.filename:
            files = {"file": (file_upload.filename, file_upload.read(), file_upload.content_type)}

        response = requests.post(
            f"{internal_url}/api/collections/{COLLECTION_NAME}/records",
            data=payload,
            files=files,
            timeout=1.5
        )

        if response.status_code in [200, 201]:
            flash("CD successfully saved directly to your local PocketBase!", "success")
        else:
            print(f"[PocketBase Add Error] Server returned {response.status_code}: {response.text}")
            flash(f"PocketBase returned an API error: {response.text}", "error")
    except requests.exceptions.RequestException as e:
        print(f"[PocketBase Add Error] Failed to connect: {e}")
        # Seamless offline backup creation
        mock_id = f"mock_{uuid.uuid4().hex[:8]}"
        mock_item = {
            "id": mock_id,
            "collectionId": "pbc_386466699",
            "collectionName": "audiocd",
            "album": album,
            "author": author,
            "cdcondition": int(cd_cond),
            "covercondition": int(cover_cond),
            "price": price,
            "file": [],
            "created": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%SZ"),
            "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%SZ")
        }
        FALLBACK_ITEMS.insert(0, mock_item)
        flash("PocketBase offline. Added CD to local memory backup!", "success")

    return redirect(url_for("index"))


@app.route("/delete/<record_id>")
def delete_cd(record_id):
    internal_url = get_pocketbase_internal_url()
    try:
        response = requests.delete(
            f"{internal_url}/api/collections/{COLLECTION_NAME}/records/{record_id}",
            timeout=1.0
        )
        if response.status_code == 204:
            flash("CD removed from collection!", "success")
        else:
            print(f"[PocketBase Delete Error] Server returned {response.status_code}: {response.text}")
            remove_from_fallback(record_id)
            flash("Removed item from local memory.", "success")
    except requests.exceptions.RequestException as e:
        print(f"[PocketBase Delete Error] Failed to connect: {e}")
        remove_from_fallback(record_id)
        flash("PocketBase offline. Removed item from local memory.", "success")

    return redirect(url_for("index"))

def remove_from_fallback(record_id):
    global FALLBACK_ITEMS
    FALLBACK_ITEMS = [item for item in FALLBACK_ITEMS if item.get("id") != record_id]


if __name__ == "__main__":
    # Runs on standard port 5000 by default (or environment-supplied port)
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Starting CD Vault Python server on port {port}...")
    app.run(host=host, port=port, debug=True)
