"use client";

import { useState, useRef } from "react";
import { ScanLine, Upload, Check, Loader2, Pencil } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
}

interface Props {
    onExtracted?: (text: string) => void;
}

export default function OcrScanner({ onExtracted }: Props) {
    const [rawText, setRawText] = useState("");
    const [editedText, setEditedText] = useState("");
    const [medicines, setMedicines] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        setDone(false);
        setError("");

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
                setMedicines(data.parsed?.extracted_medicines ?? []);
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

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <ScanLine className="text-violet-500" size={22} />
                <h2 className="text-lg font-bold text-slate-800">Prescription Scanner (OCR)</h2>
            </div>

            <div
                className="border-2 border-dashed border-violet-200 rounded-xl p-6 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors mb-4"
                onClick={() => fileRef.current?.click()}
            >
                <Upload className="mx-auto text-violet-400 mb-2" size={28} />
                <p className="text-sm font-medium text-slate-600">Click to upload a prescription image</p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP supported</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-violet-600 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Processing image with OCR...
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
            )}

            {done && (
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1">
                            <Pencil size={14} /> Extracted Text (editable)
                        </div>
                        <textarea
                            className="w-full h-32 p-3 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:ring-2 focus:ring-violet-500 outline-none"
                            value={editedText}
                            onChange={e => setEditedText(e.target.value)}
                        />
                    </div>

                    {medicines.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-slate-700 mb-2">Detected Medicines:</p>
                            <div className="space-y-1">
                                {medicines.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg text-xs text-slate-700">
                                        <Check size={12} className="text-violet-500 shrink-0" />
                                        <span className="font-medium">{m.raw_line}</span>
                                        {m.dosage && <span className="ml-auto bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{m.dosage}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
