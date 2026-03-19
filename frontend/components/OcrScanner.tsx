"use client";

import { useState, useRef } from "react";
import { ScanLine, Upload, Check, Loader2, Pencil, Plus, Trash2, PackagePlus } from "lucide-react";
import { createMedicine } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
}

interface DetectedMed {
    name: string;
    dosage: string;
    frequency: string;
    expiry_date: string;
}

interface Props {
    patientId: string;
    onMedicinesAdded?: () => void;
    onExtracted?: (text: string) => void;
}

export default function OcrScanner({ patientId, onMedicinesAdded, onExtracted }: Props) {
    const [rawText, setRawText] = useState("");
    const [editedText, setEditedText] = useState("");
    const [detectedMeds, setDetectedMeds] = useState<DetectedMed[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingAll, setAddingAll] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);
    const [addedCount, setAddedCount] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Only image files are supported (JPG, PNG, WEBP).");
            return;
        }
        setLoading(true);
        setDone(false);
        setError("");
        setDetectedMeds([]);
        setAddedCount(0);
        
        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API}/ocr/prescription`, {
                method: "POST",
                headers: getHeaders(),
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setRawText(data.raw_text);
                setEditedText(data.raw_text);
                // Build editable medicine rows from parsed results
                const meds: DetectedMed[] = (data.parsed?.extracted_medicines ?? []).map((m: any) => ({
                    name: m.name || m.raw_line?.trim() || "",
                    dosage: m.dosage || "",
                    frequency: m.frequency || "",
                    expiry_date: ""
                }));
                // Also add a blank row if nothing detected so user can manually add
                if (meds.length === 0) {
                    meds.push({ name: "", dosage: "", frequency: "", expiry_date: "" });
                }
                setDetectedMeds(meds);
                setDone(true);
                onExtracted?.(data.raw_text);
            } else {
                setError(data.error === "tesseract_not_installed"
                    ? "Tesseract OCR is not installed. Please install it from https://github.com/UB-Mannheim/tesseract/wiki"
                    : data.raw_text);
            }
        } catch {
            setError("Failed to process image. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const updateMed = (i: number, field: keyof DetectedMed, value: string) => {
        setDetectedMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    };

    const removeMed = (i: number) => {
        setDetectedMeds(prev => prev.filter((_, idx) => idx !== i));
    };

    const addBlankRow = () => {
        setDetectedMeds(prev => [...prev, { name: "", dosage: "", frequency: "", expiry_date: "" }]);
    };

    const handleAddAll = async () => {
        const toAdd = detectedMeds.filter(m => m.name.trim());
        if (!toAdd.length) return;
        setAddingAll(true);
        let count = 0;
        for (const med of toAdd) {
            try {
                await createMedicine({
                    patient_id: patientId,
                    name: med.name.trim(),
                    dosage: med.dosage || undefined,
                    frequency: med.frequency || undefined,
                    expiry_date: med.expiry_date || undefined,
                });
                count++;
            } catch { }
        }
        setAddedCount(count);
        setAddingAll(false);
        onMedicinesAdded?.();
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <ScanLine className="text-violet-500" size={22} />
                <h2 className="text-lg font-bold text-slate-800">Prescription Scanner (OCR)</h2>
            </div>

            {/* Drop Zone */}
            <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                    dragging
                        ? "border-violet-500 bg-violet-100 scale-[1.01]"
                        : "border-violet-200 hover:border-violet-400 hover:bg-violet-50"
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <Upload className={`mx-auto mb-2 transition-colors ${dragging ? "text-violet-600" : "text-violet-400"}`} size={28} />
                <p className="text-sm font-medium text-slate-600">
                    {dragging ? "Drop your prescription here!" : "Drag & drop or click to upload"}
                </p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP supported</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-violet-600 text-sm mb-3">
                    <Loader2 size={16} className="animate-spin" />
                    Processing image with OCR...
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg mb-3">{error}</div>
            )}

            {done && (
                <div className="space-y-4">
                    {/* Image Preview */}
                    {previewUrl && (
                        <div className="relative group">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Scanned Prescription</p>
                            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                <img 
                                    src={previewUrl} 
                                    className="h-full w-full object-contain" 
                                    alt="Prescription preview" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Raw text */}
                    <div>
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1">
                            <Pencil size={14} /> Extracted Text (editable)
                        </div>
                        <textarea
                            className="w-full h-24 p-3 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:ring-2 focus:ring-violet-500 outline-none"
                            value={editedText}
                            onChange={e => setEditedText(e.target.value)}
                        />
                    </div>

                    {/* Editable medicine rows */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Medicines to Add:</p>
                        <div className="space-y-2">
                            {detectedMeds.map((med, i) => (
                                <div key={i} className="bg-violet-50 border border-violet-100 rounded-lg p-3 space-y-2">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                                            placeholder="Medicine name *"
                                            value={med.name}
                                            onChange={e => updateMed(i, "name", e.target.value)}
                                        />
                                        <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                                            placeholder="Dosage (optional)"
                                            value={med.dosage}
                                            onChange={e => updateMed(i, "dosage", e.target.value)}
                                        />
                                        <input
                                            className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                                            placeholder="Frequency (optional)"
                                            value={med.frequency}
                                            onChange={e => updateMed(i, "frequency", e.target.value)}
                                        />
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-slate-400 font-medium px-1">Expiry Date (Optional)</label>
                                            <input
                                                type="date"
                                                className="px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-violet-500 outline-none bg-white text-slate-500"
                                                value={med.expiry_date}
                                                onChange={e => updateMed(i, "expiry_date", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addBlankRow}
                            className="mt-2 flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
                        >
                            <Plus size={13} /> Add another medicine row
                        </button>
                    </div>

                    {/* Add All button */}
                    <button
                        onClick={handleAddAll}
                        disabled={addingAll || !detectedMeds.some(m => m.name.trim())}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {addingAll
                            ? <><Loader2 size={15} className="animate-spin" />Adding medicines...</>
                            : <><PackagePlus size={15} />Add {detectedMeds.filter(m => m.name.trim()).length} Medicine(s) to Record</>
                        }
                    </button>

                    {addedCount > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                            <Check size={16} />
                            {addedCount} medicine(s) successfully added to this patient!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
