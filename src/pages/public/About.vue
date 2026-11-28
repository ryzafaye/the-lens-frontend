<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import PublicLayout from '../../layouts/PublicLayout.vue';
import { getPublicOfficers } from '../../services/api.js';

// State for Live Publication Officers
const officers = ref([]);
const loadingOfficers = ref(true);
const officersError = ref(null);

// Fallback officers data if database has not yet been seeded
const fallbackExecutives = [
    { name: 'Alexis Loise V. Tabaog', role: 'President', sort_order: 1 },
    { name: 'Nicole Joyce M. Andal', role: 'Executive Vice President', sort_order: 2 },
    { name: 'John Marvin C. Versoza', role: 'Secretary', sort_order: 3 },
    { name: 'Shiela Marie B. Canon', role: 'Associate Secretary', sort_order: 4 },
    { name: 'Alessandra Nicole Alecha', role: 'Associate Secretary', sort_order: 4 },
    { name: 'Kevin Chiz V. Guiang', role: 'Treasurer', sort_order: 5 },
    { name: 'Bea L. Bitara', role: 'Auditor', sort_order: 6 },
    { name: 'Rayven F. Mendoza', role: 'Public Relations Officer', sort_order: 7 },
];

function getInitials(name) {
    if (!name) return 'TL';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function handleImageError(officer) {
    officer._imgFailed = true;
}

async function fetchOfficersData() {
    loadingOfficers.value = true;
    officersError.value = null;
    try {
        const res = await getPublicOfficers();
        if (res && Array.isArray(res.officers) && res.officers.length > 0) {
            officers.value = res.officers;
        } else {
            officers.value = fallbackExecutives;
        }
    } catch (err) {
        console.warn('Could not fetch officers from API, using fallback roster:', err);
        officers.value = fallbackExecutives;
    } finally {
        loadingOfficers.value = false;
        await nextTick();
        observeRevealElements();
    }
}

// Smooth scroll to leadership section with offset for sticky header
function scrollToLeadership() {
    const el = document.getElementById('leadership');
    if (el) {
        const yOffset = -90;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// Editorial Pillars (01 / 02 / 03)
const pillars = [
    {
        num: '01',
        kicker: 'REPORTING',
        title: 'Campus reporting',
        desc: 'Timely, factual coverage and investigative reporting that keep the PUP Biñan studentry and community informed.',
    },
    {
        num: '02',
        kicker: 'ETHICS',
        title: 'Editorial responsibility',
        desc: 'Uncompromising commitment to journalistic truth, contextual depth, verification, and editorial independence.',
    },
    {
        num: '03',
        kicker: 'COMMUNITY',
        title: 'Student voices',
        desc: 'A dedicated platform spotlighting student inquiry, diverse viewpoints, creative expression, and vital discourse.',
    },
];

// Document library data
const documents = [
    {
        id: 'financial-summary',
        title: 'Financial Summary',
        subtitle: 'INCOME / EXPENSES / BALANCE',
        type: 'CSV Template',
        file: '/documents/financial-summary-template.csv',
        downloadName: 'the-lens-financial-summary-template.csv',
        description: 'An organized format for summarizing income, expenses, and the running balance for each reporting period.',
        columns: ['DATE', 'ITEM', 'AMOUNT', 'REFERENCE'],
        sampleRows: [
            ['2026-10-01', 'Editorial Printing Grant', '₱25,000.00', 'REF-PUP-001'],
            ['2026-10-15', 'Newsroom Equipment & Stationery', '₱4,500.00', 'RCPT-1024'],
            ['2026-11-02', 'Campus Press Con Registration', '₱8,200.00', 'RCPT-1088'],
            ['2026-11-20', 'Running Cash Balance', '₱12,300.00', 'BAL-AUDIT'],
        ],
    },
    {
        id: 'receipts-disbursements',
        title: 'Receipts & Disbursements',
        subtitle: 'TRANSACTION REGISTER',
        type: 'CSV Template',
        file: '/documents/receipts-disbursements-template.csv',
        downloadName: 'the-lens-receipts-disbursements-template.csv',
        description: 'A transaction register for documenting received allocations and approved disbursement vouchers.',
        columns: ['DATE', 'ITEM', 'AMOUNT', 'REFERENCE'],
        sampleRows: [
            ['2026-09-12', 'PUPBC Student Council Allocation', '₱15,000.00', 'ALLOC-26-01'],
            ['2026-09-28', 'Publication Domain & Server Hosting', '₱2,800.00', 'INV-NET-882'],
            ['2026-10-20', 'Photography Battery & SD Cards', '₱3,100.00', 'RCPT-2201'],
            ['2026-11-10', 'Student Journalist IDs & Lanyards', '₱1,950.00', 'RCPT-2244'],
        ],
    },
    {
        id: 'project-liquidation',
        title: 'Project Liquidation',
        subtitle: 'BUDGET / EXPENSES / BALANCE',
        type: 'CSV Template',
        file: '/documents/project-liquidation-template.csv',
        downloadName: 'the-lens-project-liquidation-template.csv',
        description: 'Standard format for comparing approved activity budgets with verified project expenses and remittances.',
        columns: ['DATE', 'ITEM', 'AMOUNT', 'REFERENCE'],
        sampleRows: [
            ['2026-08-15', 'Approved Coverage Budget', '₱10,000.00', 'BDG-PUP-2026'],
            ['2026-08-20', 'Press Pass Badges Printing', '₱1,500.00', 'OR-77821'],
            ['2026-09-05', 'Journalism Workshop Refreshments', '₱3,200.00', 'OR-77990'],
            ['2026-09-20', 'Unexpended Funds Remittance', '₱5,300.00', 'REMIT-TREAS'],
        ],
    },
];

// Document Preview Modal State
const previewDoc = ref(null);

function openPreview(doc) {
    previewDoc.value = doc;
    if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
    }
}

function closePreview() {
    previewDoc.value = null;
    if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
    }
}

// Intersection Observer for scroll-triggered staggered reveals
const aboutPageRef = ref(null);
let observer = null;
let isMounted = false;

function observeRevealElements() {
    if (!isMounted || typeof window === 'undefined') return;
    const root = aboutPageRef.value || document;
    const targets = root.querySelectorAll('.editorial-reveal:not(.is-revealed), .editorial-hairline:not(.is-revealed)');

    if (!('IntersectionObserver' in window)) {
        targets.forEach((el) => el.classList.add('is-revealed'));
        return;
    }

    if (!observer) {
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    observer?.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.08,
            rootMargin: '0px 0px -20px 0px',
        });
    }

    targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0) {
            el.classList.add('is-revealed');
        } else {
            observer.observe(el);
        }
    });
}

onMounted(async () => {
    isMounted = true;
    await nextTick();
    observeRevealElements();
    fetchOfficersData();
});

onUnmounted(() => {
    isMounted = false;
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
    }
});
</script>

<template>
    <PublicLayout>
        <main ref="aboutPageRef" class="about-page page-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <!-- 1. Compact Hero Banner (Peeking Next Section & Refined Typographic Masthead Accent) -->
            <section class="about-hero editorial-reveal mb-12" aria-labelledby="about-title">
                <div class="about-hero-grid flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                    <div class="about-hero-copy max-w-xl">
                        <p class="about-eyebrow text-xs font-bold tracking-widest text-rose-200 uppercase mb-2">INDEPENDENT STUDENT JOURNALISM</p>
                        <h1 id="about-title" class="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-3">
                            The Lens <em class="text-rose-200 italic font-serif">Publication</em>
                        </h1>
                        <p class="about-hero-description text-sm sm:text-base text-rose-100/90 mb-5 leading-relaxed">
                            The Official Student Journalism Body of Polytechnic University of the Philippines – Biñan Campus.
                        </p>
                        <a
                            class="about-hero-cta group inline-flex items-center gap-2.5 px-4 py-2.5 bg-white text-rose-950 text-xs font-bold rounded-lg hover:bg-rose-50 transition-all shadow-sm"
                            href="#leadership"
                            @click.prevent="scrollToLeadership"
                        >
                            <span>Meet our officers</span>
                            <i class="fa-solid fa-arrow-down text-xs transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden="true"></i>
                        </a>
                    </div>

                    <!-- Refined Editorial Typographic Masthead Accent -->
                    <aside class="about-masthead-accent w-full md:w-auto" aria-label="Publication motto and emblem">
                        <div class="masthead-seal-card border border-white/20 bg-white/[0.08] backdrop-blur-md rounded-xl p-5 sm:p-6 text-center max-w-sm mx-auto shadow-inner">
                            <span class="block text-[9px] font-bold tracking-[0.2em] text-rose-200 uppercase mb-2">PUP BIÑAN • EST. 2023</span>
                            <div class="editorial-seal-divider w-8 h-[1px] bg-rose-200/50 mx-auto mb-3"></div>
                            <p class="masthead-motto-text font-serif italic text-2xl sm:text-3xl font-extrabold text-white tracking-wide leading-tight">
                                "Basta Lente, <span class="text-rose-200">Abante!"</span>
                            </p>
                            <span class="block text-[10px] text-rose-100/75 tracking-wider uppercase mt-3">Truth • Context • Campus Voices</span>
                        </div>
                    </aside>
                </div>
            </section>

            <!-- 2. Who We Are Section (Editorial 2-Column Split + 3-Column Typographic Pillar Strip) -->
            <section class="about-intro-section editorial-reveal mb-16 pt-8 editorial-hairline" aria-labelledby="about-intro-title">
                <div class="about-section-kicker text-xs font-bold tracking-widest text-wine uppercase mb-3">WHO WE ARE</div>
                
                <!-- Editorial 2-Column Split -->
                <div class="about-intro-split grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start mb-12">
                    <div class="lg:col-span-5">
                        <h2 id="about-intro-title" class="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight leading-snug">
                            Stories that serve the campus.
                        </h2>
                    </div>
                    <div class="about-intro-copy lg:col-span-7 text-stone-600 text-sm sm:text-base leading-relaxed space-y-4">
                        <p>
                            The Lens Publication is the official student journalism body of Polytechnic University of the Philippines – Biñan Campus. We document campus affairs, student life, administrative developments, and university milestones through news, investigative reporting, features, opinion, literature, and visual storytelling.
                        </p>
                        <p>
                            Our work is founded on editorial independence, factual rigor, and care for the university community. We strive to provide transparent information, meaningful discussion, and a responsible record of our campus history.
                        </p>
                    </div>
                </div>

                <!-- 3-Column Typographic Editorial Pillar Strip (Borderless, Hairline-Divided) -->
                <div class="editorial-pillars-strip grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                    <article
                        v-for="(pillar, pIdx) in pillars"
                        :key="pillar.num"
                        class="editorial-pillar-item border-t border-stone-200 pt-5 editorial-reveal"
                        :class="'reveal-stagger-' + (pIdx + 1)"
                    >
                        <div class="flex items-baseline gap-3 mb-2">
                            <span class="pillar-number font-mono font-bold text-wine text-xs sm:text-sm tracking-wider">{{ pillar.num }}</span>
                            <span class="pillar-kicker text-[10px] font-bold tracking-widest text-stone-400 uppercase">{{ pillar.kicker }}</span>
                        </div>
                        <h3 class="font-display font-bold text-base sm:text-lg text-stone-900 mb-2">{{ pillar.title }}</h3>
                        <p class="text-xs sm:text-sm text-stone-600 leading-relaxed">{{ pillar.desc }}</p>
                    </article>
                </div>
            </section>

            <!-- 3. Publication Officers Section (Live Backend API + Modern Profile Cards) -->
            <section class="about-team-section editorial-reveal mb-16 pt-8 editorial-hairline" id="leadership" aria-labelledby="leadership-title">
                <div class="about-section-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 mb-8 border-b border-stone-200">
                    <div>
                        <p class="about-section-kicker text-xs font-bold tracking-widest text-wine uppercase">THE PEOPLE BEHIND THE STORIES</p>
                        <h2 id="leadership-title" class="font-display text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">Publication Officers</h2>
                        <p class="text-xs sm:text-sm text-stone-500 mt-1">The executive board responsible for the leadership, administration, and editorial direction of The Lens.</p>
                    </div>
                    <router-link class="about-outline-link group inline-flex items-center gap-2 text-xs font-bold text-wine border border-wine/40 px-3.5 py-2 rounded-lg hover:bg-rose-50 hover:border-wine transition-all self-start sm:self-auto" to="/members">
                        <span>See all members</span>
                        <i class="fa-solid fa-arrow-right text-[11px] transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"></i>
                    </router-link>
                </div>

                <!-- Loading Skeleton -->
                <div v-if="loadingOfficers" class="people-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6" aria-label="Loading officers">
                    <div v-for="n in 8" :key="n" class="skeleton-card border border-stone-100 rounded-xl p-4 bg-white animate-pulse">
                        <div class="w-full aspect-[4/5] bg-stone-100 rounded-lg mb-3"></div>
                        <div class="h-3 w-1/2 bg-stone-100 rounded mb-2"></div>
                        <div class="h-4 w-3/4 bg-stone-200 rounded"></div>
                    </div>
                </div>

                <!-- Live Officers Grid -->
                <div v-else-if="officers.length > 0" id="executive-grid" class="people-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    <article
                        v-for="(officer, idx) in officers"
                        :key="officer.id || idx"
                        class="officer-card group border border-stone-200/80 hover:border-wine/40 rounded-xl bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between editorial-reveal"
                        :class="'reveal-stagger-' + ((idx % 4) + 1)"
                    >
                        <!-- Officer Portrait Framing -->
                        <div class="officer-photo-frame relative w-full aspect-[4/5] bg-stone-100 overflow-hidden flex items-center justify-center">
                            <img
                                v-if="officer.profile_picture_url && !officer._imgFailed"
                                class="officer-photo w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                :src="officer.profile_picture_url"
                                :alt="officer.name + ' - ' + officer.role"
                                loading="lazy"
                                @error="handleImageError(officer)"
                            >
                            <!-- Elegant Monochrome/Maroon Fallback Avatar -->
                            <div v-else class="officer-avatar-fallback w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#f8edf1] to-[#f0dce3] text-wine p-4 text-center">
                                <span class="font-serif font-bold text-2xl sm:text-3xl tracking-wider mb-1">{{ getInitials(officer.name) }}</span>
                                <i class="fa-solid fa-pen-nib text-xs opacity-50" aria-hidden="true"></i>
                            </div>
                        </div>

                        <!-- Officer Details -->
                        <div class="officer-details p-4">
                            <p class="officer-role text-[10px] font-bold text-wine uppercase tracking-wider mb-1 line-clamp-1">{{ officer.role }}</p>
                            <h3 class="font-display font-bold text-stone-900 text-sm sm:text-base leading-snug line-clamp-2">{{ officer.name }}</h3>
                        </div>
                    </article>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center py-12 border border-dashed border-stone-200 rounded-xl bg-stone-50/60 p-6">
                    <i class="fa-solid fa-user-group text-stone-300 text-3xl mb-3" aria-hidden="true"></i>
                    <p class="font-display font-bold text-stone-700 text-base mb-1">Officer Directory Updating</p>
                    <p class="text-xs text-stone-500 max-w-md mx-auto">Publication officers for the current academic term are being synchronized with the directory.</p>
                </div>
            </section>

            <!-- 4. Financial Records & Documents (Clean Stacked Header + Interactive Cards) -->
            <section class="about-documents-section editorial-reveal mb-16 pt-8 editorial-hairline" id="documents" aria-labelledby="documents-title">
                <!-- Stacked Header Hierarchy -->
                <div class="about-section-heading mb-8">
                    <p class="about-section-kicker text-xs font-bold tracking-widest text-wine uppercase mb-1">DOCUMENT LIBRARY</p>
                    <h2 id="documents-title" class="font-display text-2xl sm:text-3xl font-extrabold text-stone-900">Financial Records &amp; Documents</h2>
                    <p class="about-section-lead text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl">
                        Official financial templates and public liquidation records maintained for editorial transparency, student audit readiness, and accountability.
                    </p>
                </div>

                <!-- Document Cards Grid -->
                <div id="document-library-grid" class="document-library-grid grid grid-cols-1 md:grid-cols-3 gap-6">
                    <article
                        v-for="(doc, dIdx) in documents"
                        :key="doc.id"
                        class="document-card group border border-stone-200/90 hover:border-wine/40 rounded-xl bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between editorial-reveal"
                        :class="'reveal-stagger-' + (dIdx + 1)"
                        :data-document-id="doc.id"
                    >
                        <!-- Document Mockup Area with Hover Reveal Preview Trigger -->
                        <div class="relative bg-gradient-to-b from-[#faf4f6] to-[#f4e8ed] p-5 pb-6 border-b border-stone-200/60 overflow-hidden cursor-pointer" @click="openPreview(doc)">
                            <!-- Document Thumbnail Sheet -->
                            <div class="bg-white rounded-lg shadow-sm border border-stone-200/90 p-4 pt-3 flex flex-col items-center relative overflow-hidden w-full max-w-[230px] mx-auto min-h-[180px]">
                                <!-- Top Maroon Bar -->
                                <div class="w-full h-1.5 bg-[#571525] rounded-t mb-2.5"></div>
                                <h4 class="font-serif font-bold text-[11px] text-stone-900 tracking-wider text-center uppercase">{{ doc.title }}</h4>
                                <p class="text-[8px] text-stone-400 font-bold tracking-widest text-center uppercase mt-0.5">{{ doc.subtitle }}</p>

                                <!-- Column Headers Mini -->
                                <div class="w-full mt-2.5 bg-stone-100 border-y border-stone-200 py-1 px-1 flex items-center justify-between text-[7px] font-bold text-stone-500 uppercase tracking-tight">
                                    <span v-for="col in doc.columns.slice(0, 3)" :key="col">{{ col }}</span>
                                </div>

                                <!-- Ruled Mini Lines -->
                                <div class="w-full space-y-1.5 mt-2 px-0.5">
                                    <div class="w-full h-1 bg-stone-100 rounded"></div>
                                    <div class="w-full h-1 bg-stone-100 rounded"></div>
                                    <div class="w-full h-1 bg-stone-100 rounded"></div>
                                </div>

                                <!-- Angled Sample Stamp -->
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
                                    <div class="border border-[#571525] text-[#571525] font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded transform -rotate-12 bg-white/95 shadow-xs">
                                        OFFICIAL TEMPLATE
                                    </div>
                                </div>
                            </div>

                            <!-- Sleek Hover Overlay / Action (and tap-friendly pill on mobile) -->
                            <div class="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4">
                                <button
                                    type="button"
                                    class="px-4 py-2.5 min-h-[44px] bg-white text-stone-900 text-xs font-bold rounded-lg shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200 inline-flex items-center gap-2 hover:bg-rose-50"
                                    @click.stop="openPreview(doc)"
                                >
                                    <i class="fa-solid fa-expand text-[10px]" aria-hidden="true"></i>
                                    <span>Preview document</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                class="md:hidden mt-3 mx-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-white/95 border border-stone-200 text-wine text-[11px] font-bold rounded-lg shadow-xs"
                                @click.stop="openPreview(doc)"
                            >
                                <i class="fa-solid fa-expand text-[10px]" aria-hidden="true"></i>
                                <span>Preview document</span>
                            </button>
                        </div>

                        <!-- Document Details & Download Action -->
                        <div class="document-card-body p-5 flex flex-col justify-between flex-grow">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{{ doc.type }}</span>
                                    <span class="text-[9px] font-bold font-mono text-wine bg-rose-50 px-2 py-0.5 rounded border border-wine/20">CSV FORMAT</span>
                                </div>
                                <h3 class="font-display font-bold text-base sm:text-lg text-stone-900 mb-2">{{ doc.title }}</h3>
                                <p class="text-xs text-stone-600 leading-relaxed mb-4">{{ doc.description }}</p>
                            </div>

                            <!-- Crisp Download Button -->
                            <a
                                class="document-download-btn w-full py-2.5 px-4 bg-[#571525] hover:bg-[#400817] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-xs"
                                :href="doc.file"
                                :download="doc.downloadName"
                            >
                                <i class="fa-solid fa-download text-xs" aria-hidden="true"></i>
                                <span>Download template</span>
                            </a>
                        </div>
                    </article>
                </div>
            </section>

            <!-- 5. Document Preview Modal Dialog -->
            <div
                v-if="previewDoc"
                class="fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all"
                role="dialog"
                aria-modal="true"
                :aria-label="previewDoc.title + ' Preview'"
                @click.self="closePreview"
            >
                <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-stone-200 flex flex-col animate-scale-up">
                    <div class="p-5 sm:p-6 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                        <div>
                            <span class="text-[10px] font-bold text-wine uppercase tracking-widest">{{ previewDoc.type }}</span>
                            <h3 class="font-display font-extrabold text-lg sm:text-xl text-stone-900">{{ previewDoc.title }}</h3>
                        </div>
                        <button
                            type="button"
                            class="w-8 h-8 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center hover:bg-stone-300 transition-colors"
                            aria-label="Close dialog"
                            @click="closePreview"
                        >
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>

                    <div class="p-5 sm:p-6 overflow-y-auto space-y-4">
                        <p class="text-xs sm:text-sm text-stone-600 leading-relaxed">{{ previewDoc.description }}</p>
                        
                        <div class="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-[#571525] text-white">
                                        <th v-for="(col, cIdx) in previewDoc.columns" :key="col" class="py-2.5 px-3 font-semibold tracking-wider text-[11px]" :class="cIdx === 0 ? 'text-left' : 'text-center'">
                                            {{ col }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-stone-100">
                                    <tr v-for="(row, rIdx) in previewDoc.sampleRows" :key="rIdx" class="hover:bg-rose-50/40">
                                        <td v-for="(val, cIdx) in row" :key="cIdx" class="py-2.5 px-3 text-stone-700 font-mono text-[11px]">
                                            {{ val }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                        <button type="button" class="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors" @click="closePreview">
                            Close Preview
                        </button>
                        <a :href="previewDoc.file" :download="previewDoc.downloadName" class="px-5 py-2.5 bg-[#571525] text-white text-xs font-bold rounded-lg hover:bg-[#400817] transition-colors inline-flex items-center gap-2">
                            <i class="fa-solid fa-download" aria-hidden="true"></i>
                            <span>Download CSV</span>
                        </a>
                    </div>
                </div>
            </div>
        </main>
    </PublicLayout>
</template>
