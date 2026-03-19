"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ShieldX, Building2, CreditCard, Hospital } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface Props { patientId: string; }

export default function InsuranceSection({ patientId }: Props) {
    const [hasInsurance, setHasInsurance] = useState(false);
    const [form, setForm] = useState({ insurance_company: "", policy_number: "", hospital_name: "" });
    const [result, setResult] = useState<null | { is_connected: boolean; status: string }>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`${API}/insurance/${patientId}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(d => {
                if (d.has_insurance) {
                    setHasInsurance(true);
                    setForm({ insurance_company: d.insurance_company, policy_number: d.policy_number, hospital_name: d.hospital_name });
                    setResult({ is_connected: d.is_connected, status: d.status });
                }
            }).catch(() => { });
    }, [patientId]);

    const handleVerify = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/insurance`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ patient_id: patientId, ...form })
            });
            const data = await res.json();
            setResult({ is_connected: data.is_connected, status: data.status });
        } catch { } finally { setLoading(false); }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="text-blue-500" size={22} />
                <h2 className="text-lg font-bold text-slate-800">Insurance Verification</h2>
            </div>

            <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-medium text-slate-600">Has Insurance?</span>
                <button
                    onClick={() => setHasInsurance(!hasInsurance)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${hasInsurance ? "bg-blue-500" : "bg-slate-300"}`}
                >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hasInsurance ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
                <span className="text-sm text-slate-500 font-medium">{hasInsurance ? "Yes" : "No"}</span>
            </div>

            {hasInsurance && (
                <div className="space-y-3">
                    <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Insurance Company (e.g. Star Health)"
                            value={form.insurance_company}
                            onChange={e => setForm(f => ({ ...f, insurance_company: e.target.value }))}
                        />
                    </div>
                    <div className="relative">
                        <CreditCard size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Policy Number"
                            value={form.policy_number}
                            onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))}
                        />
                    </div>
                    <div className="relative">
                        <Hospital size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Hospital Name (e.g. Apollo Hospital)"
                            value={form.hospital_name}
                            onChange={e => setForm(f => ({ ...f, hospital_name: e.target.value }))}
                        />
                    </div>

                    <button
                        onClick={handleVerify}
                        disabled={loading || !form.insurance_company || !form.hospital_name || !form.policy_number}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {loading ? "Verifying..." : "Verify Insurance Network"}
                    </button>

                    {result && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${result.is_connected ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {result.is_connected
                                ? <ShieldCheck size={18} />
                                : <ShieldX size={18} />
                            }
                            {result.status}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
