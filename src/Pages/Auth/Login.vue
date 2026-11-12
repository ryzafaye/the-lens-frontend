<script setup>
import { ref } from 'vue';
import PageHead from '../../Components/PageHead.vue';
import { useApiForm } from '../../composables/useApiForm.js';
import { useAppState } from '../../state/appState.js';
import { router } from '../../router/index.js';

const props = defineProps({
    studentNumber: { type: String, default: '' },
});

const page = useAppState();
const showPassword = ref(false);
const form = useApiForm({ student_number: props.studentNumber ?? '', password: '' });

function submit() {
    form.post('/login', {
        onSuccess: (result) => {
            const user = result.user ?? result.shared?.auth?.user ?? page.props.auth?.user;
            const role = String(user?.role ?? '').toLowerCase();
            const portal = user?.portal
                ?? (role.includes('cartoonist') ? 'cartoonist'
                    : role.includes('photojournalist') || role.includes('media team') ? 'media'
                    : role.includes('m&pc') ? 'mpc'
                    : role.includes('editor-in-chief') || role.includes('associate editor') ? 'eic'
                    : role === 'writer' ? 'writer'
                    : role.endsWith('head') ? 'section-head'
                    : 'executive');
            const destination = result.redirect ?? new URLSearchParams(window.location.search).get('redirect') ?? `/${portal}/dashboard`;
            router.visit(destination);
        },
    });
}
</script>

<template>
    <PageHead title="Login | The Lens" />
    <main class="min-h-screen bg-white font-body text-stone-900 flex items-center justify-center p-4 sm:p-8 md:p-12 relative overflow-x-hidden">
        <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(112,15,43,0.04),transparent_70%)]"></div>
        <div class="book-wrapper w-full max-w-4xl lg:max-w-5xl relative z-10 my-6">
            <div class="book-edge-stack hidden sm:block"></div><div class="book-edge-stack-sub hidden sm:block"></div>
            <div class="open-book bg-stone-900 flex flex-col lg:flex-row rounded-2xl sm:rounded-3xl overflow-hidden relative border-4 border-[#3a0614] z-10">
                <section class="relative lg:w-1/2 py-6 px-4 sm:py-8 sm:px-6 lg:p-14 min-h-[140px] sm:min-h-[180px] lg:min-h-[580px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#22020b] via-[#4a091b] to-[#120207] shadow-inner">
                    <div class="pointer-events-none absolute -top-16 -left-16 w-80 h-80 rounded-full bg-rose-600/25 blur-3xl animate-drift-1"></div><div class="pointer-events-none absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-wine/50 blur-3xl animate-drift-2"></div>
                    <div class="relative z-10 flex items-center justify-center"><div class="relative group"><div class="absolute -inset-3 sm:-inset-4 lg:-inset-6 rounded-full bg-gradient-to-tr from-rose-600/50 via-wine/70 to-amber-500/35 blur-xl sm:blur-2xl animate-pulse-glow"></div><div class="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-80 lg:h-80 rounded-full p-2 lg:p-3 bg-gradient-to-b from-white/30 via-white/10 to-transparent shadow-xl lg:shadow-2xl backdrop-blur-xl animate-float-logo"><div class="w-full h-full rounded-full overflow-hidden border border-white/40 lg:border-2 shadow-inner bg-[#4a091b]"><img :src="'/images/logo.jpg'" alt="The Lens Logo" class="w-full h-full object-cover select-none"></div></div></div></div>
                </section>
                <section class="lg:w-1/2 flex flex-col justify-center p-6 sm:p-10 lg:p-16 bg-white relative">
                    <a href="/" class="absolute top-4 right-4 sm:top-8 sm:right-8 z-30 group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-stone-500 hover:text-wine py-1.5 px-3 rounded-lg hover:bg-stone-100" aria-label="Back to public site"><i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i><span>Back to site</span></a>
                    <div class="w-full max-w-sm mx-auto relative z-20 pt-6">
                        <div class="mb-6 sm:mb-8"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase bg-rose-900/10 text-rose-900 mb-3">Member Portal</span><h1 class="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">Sign In</h1><p class="mt-1.5 text-sm text-stone-500">Enter your student number and password to proceed.</p></div>
                        <div v-if="form.errors.student_number || form.errors.general || page.props.errors?.student_number" class="mb-6 p-3.5 rounded-xl text-xs sm:text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2" role="alert"><i class="fa-solid fa-circle-exclamation text-rose-500" aria-hidden="true"></i><span>{{ form.errors.student_number || form.errors.general || page.props.errors.student_number }}</span></div>
                        <form id="login-form" class="space-y-5" @submit.prevent="submit">
                            <div class="space-y-1.5"><label for="student-number" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">Student Number</label><div class="relative group"><div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400"><i class="fa-regular fa-id-card text-base"></i></div><input type="text" id="student-number" v-model="form.student_number" required autocomplete="username" placeholder="0000-00000-BN-0" class="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-stone-200 bg-stone-50/60 text-stone-900 placeholder:text-stone-400 text-sm font-medium tracking-wide focus:outline-none focus:border-rose-900 focus:bg-white focus:ring-4 focus:ring-rose-900/10 shadow-sm"></div></div>
                            <div class="space-y-1.5"><label for="password" class="block text-xs font-semibold uppercase tracking-wider text-stone-800">Password</label><div class="relative group"><div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400"><i class="fa-solid fa-lock text-sm"></i></div><input v-model="form.password" :type="showPassword ? 'text' : 'password'" id="password" required autocomplete="current-password" placeholder="Enter your password" class="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-stone-200 bg-stone-50/60 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:border-rose-900 focus:bg-white focus:ring-4 focus:ring-rose-900/10 shadow-sm"><button type="button" @click="showPassword = !showPassword" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700" :aria-label="showPassword ? 'Hide password' : 'Show password'"><i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i></button></div></div>
                            <div class="pt-2"><button type="submit" :disabled="form.processing" class="shimmer-button w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#700f2b] to-[#8d1337] hover:from-[#5e0c24] hover:to-[#700f2b] text-white font-medium text-sm tracking-wide shadow-md shadow-rose-900/25"><span>{{ form.processing ? 'Signing in…' : 'Log In' }}</span><i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></button></div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    </main>
</template>

<style scoped>
.book-wrapper { perspective: 1600px; }
.open-book { transform-style: preserve-3d; box-shadow: 0 30px 60px -15px rgba(58,6,20,.22),0 15px 35px -10px rgba(0,0,0,.12),0 0 0 1px rgba(74,9,27,.08); }
.book-edge-stack,.book-edge-stack-sub { position:absolute; background:linear-gradient(to bottom,#eae7e1,#d4cfc5); border-radius:0 0 16px 16px; }
.book-edge-stack { bottom:-8px;left:20px;right:20px;height:10px;box-shadow:0 4px 10px rgba(0,0,0,.15); }
.book-edge-stack-sub { bottom:-14px;left:36px;right:36px;height:8px;z-index:-1; }
@keyframes floatLogo { 0%,100%{transform:translateY(0)}50%{transform:translateY(-10px) rotate(.8deg)} }
@keyframes pulseGlow { 0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:.85;transform:scale(1.1)} }
@keyframes driftOrb1 { 0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(25px,-20px) scale(1.15)} }
@keyframes driftOrb2 { 0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,25px) scale(1.1)} }
.animate-float-logo { animation:floatLogo 5.5s ease-in-out infinite; }
.animate-pulse-glow { animation:pulseGlow 4.5s ease-in-out infinite; }
.animate-drift-1 { animation:driftOrb1 12s ease-in-out infinite; }
.animate-drift-2 { animation:driftOrb2 14s ease-in-out infinite; }
.shimmer-button { position:relative;overflow:hidden; }
@media (prefers-reduced-motion: reduce) { .animate-float-logo,.animate-pulse-glow,.animate-drift-1,.animate-drift-2 { animation:none; } }
</style>
