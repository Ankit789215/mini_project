"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, HeartPulse } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, signOut } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <HeartPulse size={24} />
                        </div>
                        <span className="font-bold text-xl text-slate-800">Family Health</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-600 hidden sm:block">
                            {user?.email}
                        </span>
                        <button
                            onClick={signOut}
                            className="p-2 text-slate-500 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
                {children}
            </main>
        </div>
    );
}
