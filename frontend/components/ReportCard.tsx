"use client";

import { useState, useEffect } from "react";
import { ClipboardList, CheckCircle2, XCircle, RefreshCw, Sparkles, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface Props {
    patientId: string;
    medicines: { id: string; name: string }[];
}

interface Report {
    period: string;
    total_doses: number;
    taken: number;
    missed: number;
    adherence_percentage: number;
    suggestion: string;
    by_medicine: Record<string, { taken: number; missed: number }>;
}

export default function ReportCard({ patientId, medicines }: Props) {
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);
    const [logLoading, setLogLoading] = useState<string | null>(null);
    const [aiReport, setAiReport] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/report/weekly/${patientId}`, { headers: getHeaders() });
            const data = await res.json();
            setReport(data);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchReport(); }, [patientId]);

    const generateAiReport = async () => {
        setAiLoading(true);
        setAiReport("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/report/ai-summary/${patientId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok || !res.body) throw new Error("Failed");
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setAiReport(prev => prev + decoder.decode(value));
            }
        } catch {
            setAiReport("Failed to generate AI report. Please try again.");
        } finally {
            setAiLoading(false);
        }
    };

    const logDose = async (medicineName: string, taken: boolean) => {
        setLogLoading(medicineName);
        try {
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, "0");
            const scheduled = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
            await fetch(`${API}/report/log`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ patient_id: patientId, medicine_name: medicineName, scheduled_time: scheduled, taken })
            });
            await fetchReport();
        } catch { } finally { setLogLoading(null); }
    };

    const pct = report?.adherence_percentage ?? 0;
    const pctColor = pct >= 90 ? "text-green-600" : pct >= 70 ? "text-amber-500" : "text-red-500";
    const ringColor = pct >= 90 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#ef4444";
    const circumference = 2 * Math.PI * 36; // r=36
    const dashOffset = circumference - (pct / 100) * circumference;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ClipboardList className="text-amber-500" size={22} />
                    <h2 className="text-lg font-bold text-slate-800">Weekly Report Card</h2>
                </div>
                <button onClick={fetchReport} className="text-slate-400 hover:text-amber-500 transition-colors">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {report && (
                <>
                    <div className="flex items-center gap-6 mb-5">
                        {/* Circular progress */}
                        <div className="relative w-24 h-24 shrink-0">
                            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                                <circle cx="40" cy="40" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                                <circle
                                    cx="40" cy="40" r="36" fill="none"
                                    stroke={ringColor} strokeWidth="8"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                    strokeLinecap="round"
                                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xl font-bold ${pctColor}`}>{pct}%</span>
                                <span className="text-xs text-slate-400">adherent</span>
                            </div>
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" /><span className="text-slate-600">{report.taken} doses taken</span></div>
                            <div className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /><span className="text-slate-600">{report.missed} doses missed</span></div>
                            <div className="text-xs text-slate-500 mt-1">{report.period}</div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 mb-4">
                        {report.suggestion}
                    </div>
                </>
            )}

            {/* Quick log buttons */}
            <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Log Today's Dose:</p>
                <div className="space-y-2">
                    {medicines.map(med => (
                        <div key={med.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700 truncate max-w-[60%]">{med.name}</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => logDose(med.name, true)}
                                    disabled={logLoading === med.name}
                                    className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-md transition-colors"
                                >Taken</button>
                                <button
                                    onClick={() => logDose(med.name, false)}
                                    disabled={logLoading === med.name}
                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-md transition-colors"
                                >Missed</button>
                            </div>
                        </div>
                    ))}
                    {medicines.length === 0 && <p className="text-xs text-slate-400">Add medicines to track adherence.</p>}
                </div>
            </div>

            {/* AI Weekly Report */}
            <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                    onClick={generateAiReport}
                    disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-medium rounded-lg transition-all text-sm"
                >
                    {aiLoading
                        ? <><Loader2 size={15} className="animate-spin" />Generating AI Report...</>
                        : <><Sparkles size={15} />Generate AI Weekly Report</>}
                </button>

                {aiReport && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles size={14} className="text-violet-600" />
                            <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">AI Health Report · llama-3.1-8b</span>
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                            {aiReport}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
