"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchMedicines, createMedicine, deleteMedicine, fetchReminders, createReminder, deleteReminder } from "@/lib/api";
import { Medicine, Reminder } from "@/types/schema";
import { Pill, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Loader2, Plus, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function PatientDetail() {
    const { patientId } = useParams();

    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [medOffset, setMedOffset] = useState(0);
    const [hasMoreMeds, setHasMoreMeds] = useState(true);
    const MED_LIMIT = 20;

    // Med Form
    const [medName, setMedName] = useState("");
    const [medDosage, setMedDosage] = useState("");
    const [medFreq, setMedFreq] = useState("");
    const [medExpiry, setMedExpiry] = useState("");

    // Rem Form
    const [remTime, setRemTime] = useState("");
    const [remRepeat, setRemRepeat] = useState("daily");

    const loadData = useCallback(async (resetMeds = false, currentMedOffset = 0) => {
        setLoading(true);
        try {
            const reqOffset = resetMeds ? 0 : currentMedOffset;
            const [meds, rems] = await Promise.all([
                fetchMedicines(patientId as string, MED_LIMIT, reqOffset),
                fetchReminders(patientId as string)
            ]);
            setMedicines(prev => resetMeds ? meds : [...prev, ...meds]);
            setHasMoreMeds(meds.length === MED_LIMIT);
            setMedOffset(reqOffset + meds.length);
            setReminders(rems);
        } catch (e) {
            console.error(e);
            alert("Failed to fetch data.");
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        if (patientId) loadData(true, 0);
    }, [patientId, loadData]);

    const handleAddMed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!medName.trim()) return;
        try {
            await createMedicine({
                patient_id: patientId as string,
                name: medName,
                dosage: medDosage || undefined,
                frequency: medFreq || undefined,
                expiry_date: medExpiry || undefined
            });
            setMedName(""); setMedDosage(""); setMedFreq(""); setMedExpiry("");
            loadData(true, 0);
        } catch { }
    };

    const handleAddRem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!remTime) return;
        try {
            // Build a local datetime string like "2026-03-19T15:03:00"
            // Avoid .toISOString() which converts to UTC and shifts the time
            const today = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const localDatetime = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${remTime}:00`;

            await createReminder({
                patient_id: patientId as string,
                reminder_time: localDatetime,
                repeat_type: remRepeat
            });
            setRemTime(""); setRemRepeat("daily");
            loadData(true, 0);
        } catch { }
    };

    const ExpiryBadge = ({ days }: { days: number | null | undefined }) => {
        if (days === null || days === undefined) return <span className="text-sm text-slate-400">No Expiry</span>;
        if (days < 0) return <span className="flex items-center gap-1 text-sm font-bold text-red-600"><ShieldAlert size={14} /> Expired</span>;
        if (days <= 30) return <span className="flex items-center gap-1 text-sm font-bold text-amber-600"><AlertTriangle size={14} /> {days}d left</span>;
        return <span className="flex items-center gap-1 text-sm font-medium text-emerald-600"><CheckCircle2 size={14} /> {days}d left</span>;
    };

    if (loading && medicines.length === 0) return <div className="h-64 flex justify-center items-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                    <ArrowLeft size={20} className="text-slate-600" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">Patient Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* MEDICINES SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Pill className="text-emerald-500" /> Medications</h2>
                    </div>

                    <form onSubmit={handleAddMed} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                        <input placeholder="Medicine Name" required value={medName} onChange={e => setMedName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Dosage (e.g. 500mg)" value={medDosage} onChange={e => setMedDosage(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                            <input placeholder="Frequency (e.g. Twice daily)" value={medFreq} onChange={e => setMedFreq(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="date" value={medExpiry} onChange={e => setMedExpiry(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-slate-600" />
                            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1"><Plus size={16} /> Add</button>
                        </div>
                    </form>

                    <div className="space-y-3">
                        {medicines.map(m => (
                            <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800">{m.name}</h3>
                                    <p className="text-sm text-slate-500">{m.dosage} • {m.frequency}</p>
                                    <div className="mt-1"><ExpiryBadge days={m.days_to_expiry} /></div>
                                </div>
                                <button onClick={async () => { await deleteMedicine(m.id); loadData(true, 0); }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {hasMoreMeds && medicines.length > 0 && !loading && (
                            <button
                                onClick={() => loadData(false, medOffset)}
                                className="w-full py-2 text-sm text-slate-500 hover:text-emerald-600 transition font-medium"
                            >
                                Load More Medications
                            </button>
                        )}
                        {medicines.length === 0 && <p className="text-slate-400 text-sm text-center py-4 bg-white rounded-xl border border-dashed">No medications recorded.</p>}
                    </div>
                </div>

                {/* REMINDERS SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Clock className="text-amber-500" /> Reminders</h2>
                    </div>

                    <form onSubmit={handleAddRem} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                        <div className="flex gap-3">
                            <input type="time" required value={remTime} onChange={e => setRemTime(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg" />
                            <select value={remRepeat} onChange={e => setRemRepeat(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg bg-white">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="none">Once</option>
                            </select>
                        </div>
                        <button className="w-full bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 flex items-center justify-center gap-1"><Plus size={16} /> Set Reminder</button>
                    </form>

                    <div className="space-y-3">
                        {reminders.map(r => (
                            <div key={r.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800">{format(new Date(r.reminder_time), 'h:mm a')}</h3>
                                    <p className="text-sm text-slate-500 capitalize">{r.repeat_type} Reminder</p>
                                </div>
                                <button onClick={() => { deleteReminder(r.id); loadData(true, 0); }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {reminders.length === 0 && <p className="text-slate-400 text-sm text-center py-4 bg-white rounded-xl border border-dashed">No reminders set.</p>}
                    </div>
                </div>

            </div>
        </div>
    );
}
