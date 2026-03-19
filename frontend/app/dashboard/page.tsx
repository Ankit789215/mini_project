"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchPatients, createPatient, deletePatient } from "@/lib/api";
import { Patient } from "@/types/schema";
import { Loader2, Plus, UserCircle, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardOverview() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 12;

    const [newName, setNewName] = useState("");
    const [newAge, setNewAge] = useState("");
    const [newRelation, setNewRelation] = useState("");
    const [newEmail, setNewEmail] = useState("");

    const loadPatients = useCallback(async (reset = false, currentOffset = 0) => {
        try {
            setIsLoading(true);
            setError(null);
            
            const reqOffset = reset ? 0 : currentOffset;
            const data = await fetchPatients(LIMIT, reqOffset);
            
            setPatients(prev => reset ? data : [...prev, ...data]);
            setHasMore(data.length === LIMIT);
            setOffset(reqOffset + data.length);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPatients(true, 0);
    }, [loadPatients]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            setError(null);
            await createPatient({
                patient_name: newName.trim(),
                age: newAge ? parseInt(newAge) : undefined,
                relation: newRelation.trim() || undefined,
                email: newEmail.trim() || undefined,
            });
            setNewName("");
            setNewAge("");
            setNewRelation("");
            setNewEmail("");
            setIsAdding(false);
            loadPatients(true, 0);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault(); // prevent triggering the link navigation
        if (!confirm("Delete this patient and all their meds/reminders?")) return;
        try {
            await deletePatient(id);
            loadPatients(true, 0);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Family Members</h1>
                    <p className="text-slate-500 text-sm">Select a member to manage their medications and reminders.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus size={20} /> <span className="hidden sm:inline">Add Member</span>
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                    {error}
                </div>
            )}

            {isAdding && (
                <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid gap-4 grid-cols-1 md:grid-cols-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Name</label>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="e.g. John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Age (Optional)</label>
                        <input
                            type="number"
                            min={0}
                            value={newAge}
                            onChange={(e) => setNewAge(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="e.g. 45"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Relation</label>
                        <input
                            type="text"
                            value={newRelation}
                            onChange={(e) => setNewRelation(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="e.g. Self, Parent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email (Optional)</label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="e.g. patient@example.com"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button type="submit" className="w-full h-10 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition">
                            Save
                        </button>
                        <button type="button" onClick={() => setIsAdding(false)} className="w-full h-10 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition">
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {isLoading ? (
                <div className="h-64 flex items-center justify-center text-emerald-600">
                    <Loader2 className="animate-spin w-8 h-8" />
                </div>
            ) : patients.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-3xl">
                    <UserCircle size={48} className="mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-600">No family members found.</p>
                    <p className="text-sm">Click &quot;Add Member&quot; to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {patients.map((p) => (
                        <Link
                            key={p.id}
                            href={`/dashboard/${p.id}`}
                            className="group bg-white border border-slate-200 p-6 rounded-3xl hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all relative overflow-hidden flex flex-col"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <button
                                    onClick={(e) => handleDelete(e, p.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                                <UserCircle size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">
                                {p.patient_name}
                            </h3>
                            <div className="text-sm text-slate-500 space-x-2">
                                {p.relation && <span>{p.relation}</span>}
                                {p.relation && (p.age || p.email) && <span>•</span>}
                                {p.age && <span>{p.age} years old</span>}
                                {p.age && p.email && <span>•</span>}
                                {p.email && <span className="truncate block mt-1 text-xs">{p.email}</span>}
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-emerald-600 font-medium text-sm group-hover:gap-2 transition-all">
                                Manage Profile <ArrowRight size={16} className="ml-1" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {hasMore && patients.length > 0 && !isLoading && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => loadPatients(false, offset)}
                        className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition"
                    >
                        Load More Members
                    </button>
                </div>
            )}
        </div>
    );
}
