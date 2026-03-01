"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { HeartPulse, Loader2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        let result;
        if (isLogin) {
            result = await supabase.auth.signInWithPassword({ email, password });
        } else {
            result = await supabase.auth.signUp({ email, password });
        }

        if (result.error) {
            setError(result.error.message);
            setLoading(false);
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 border border-emerald-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                        <HeartPulse size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Family Health</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage family meds securely</p>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-lg mb-8">
                    <button
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${isLogin ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!isLogin ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            placeholder="you@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all pr-12"
                                placeholder="••••••••"
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-lg shadow-emerald-600/20"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Sign In" : "Create Account")}
                    </button>
                </form>

                {!isLogin && (
                    <p className="text-center text-xs text-slate-500 mt-6 px-4">
                        <b>Note:</b> Supabase rate limits new signups (3/hr) on free tiers. If you hit a limit, disable email confirmations in your Supabase Auth dashboard.
                    </p>
                )}
            </div>
        </div>
    );
}
