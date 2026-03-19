"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Footprints, Activity, Save, Camera, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface VitalRecord {
    id: string;
    heart_rate: number | null;
    steps: number | null;
    activity_level: string | null;
    timestamp: string;
}

interface Props { patientId: string; }

export default function VitalsSection({ patientId }: Props) {
    const [hr, setHr] = useState<number | null>(null);
    const [steps, setSteps] = useState("");
    const [activity, setActivity] = useState("Moderate");
    const [records, setRecords] = useState<VitalRecord[]>([]);
    const [measuring, setMeasuring] = useState(false);
    const [savingVitals, setSavingVitals] = useState(false);
    const [ppgProgress, setPpgProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        fetch(`${API}/vitals/${patientId}`, { headers: getHeaders() })
            .then(r => r.json()).then(setRecords).catch(() => { });
    }, [patientId]);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setMeasuring(false);
    }, []);

    const measureHeartRate = async () => {
        if (measuring) { stopCamera(); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setMeasuring(true);
            setPpgProgress(0);

            const samples: number[] = [];
            const DURATION = 15000;
            const start = Date.now();

            const ctx = canvasRef.current?.getContext("2d");

            const tick = () => {
                if (!streamRef.current || !ctx || !videoRef.current || !canvasRef.current) return;
                ctx.drawImage(videoRef.current, 0, 0, 10, 10);
                const pixel = ctx.getImageData(0, 0, 10, 10).data;
                let rTotal = 0;
                for (let i = 0; i < pixel.length; i += 4) rTotal += pixel[i];
                samples.push(rTotal / (pixel.length / 4));

                const elapsed = Date.now() - start;
                setPpgProgress(Math.min(100, (elapsed / DURATION) * 100));

                if (elapsed < DURATION) {
                    requestAnimationFrame(tick);
                } else {
                    stopCamera();
                    // Estimate BPM from red channel peaks
                    if (samples.length > 30) {
                        const mean = samples.reduce((a, b) => a + b) / samples.length;
                        let peaks = 0;
                        for (let i = 1; i < samples.length - 1; i++) {
                            if (samples[i] > mean * 1.02 && samples[i] > samples[i - 1] && samples[i] > samples[i + 1]) peaks++;
                        }
                        const bpm = Math.round((peaks / (DURATION / 1000)) * 60 * 0.25);
                        const clampedBpm = Math.min(120, Math.max(50, bpm));
                        setHr(clampedBpm);
                    }
                }
            };
            requestAnimationFrame(tick);
        } catch (err) {
            alert("Camera access denied or not available. Please enter heart rate manually.");
            setMeasuring(false);
        }
    };

    const saveVitals = async () => {
        setSavingVitals(true);
        try {
            await fetch(`${API}/vitals`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ patient_id: patientId, heart_rate: hr, steps: steps ? parseInt(steps) : null, activity_level: activity })
            });
            const updated = await fetch(`${API}/vitals/${patientId}`, { headers: getHeaders() }).then(r => r.json());
            setRecords(updated);
        } catch { } finally { setSavingVitals(false); }
    };

    const lastRecord = records[records.length - 1];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <Heart className="text-rose-500" size={22} />
                <h2 className="text-lg font-bold text-slate-800">Vitals Monitoring</h2>
            </div>

            {/* PPG Camera */}
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={measureHeartRate}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${measuring ? "bg-red-500 hover:bg-red-600 text-white" : "bg-rose-100 hover:bg-rose-200 text-rose-700"}`}
                    >
                        {measuring ? <><Loader2 size={14} className="animate-spin" />Stop Measuring</> : <><Camera size={14} />Measure Heart Rate via Camera</>}
                    </button>
                    {hr !== null && (
                        <div className="flex items-center gap-1 text-rose-600 font-bold">
                            <Heart size={16} className="fill-rose-500 text-rose-500" />
                            {hr} BPM
                        </div>
                    )}
                </div>
                {measuring && (
                    <div className="mb-2">
                        <div className="text-xs text-slate-500 mb-1">Hold camera over finger tip — {Math.round(ppgProgress)}% complete</div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-rose-500 h-1.5 rounded-full transition-all" style={{ width: `${ppgProgress}%` }} />
                        </div>
                    </div>
                )}
                <video ref={videoRef} className="hidden w-1 h-1" muted playsInline />
                <canvas ref={canvasRef} width={10} height={10} className="hidden" />

                {/* Manual HR input */}
                <input
                    type="number"
                    placeholder="Or enter heart rate manually (BPM)"
                    value={hr ?? ""}
                    onChange={e => setHr(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none mt-2"
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="relative">
                    <Footprints size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                        type="number"
                        placeholder="Steps today"
                        value={steps}
                        onChange={e => setSteps(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                </div>
                <div className="relative">
                    <Activity size={16} className="absolute left-3 top-3 text-slate-400" />
                    <select
                        value={activity}
                        onChange={e => setActivity(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none appearance-none bg-white"
                    >
                        <option>Sedentary</option>
                        <option>Light</option>
                        <option>Moderate</option>
                        <option>Active</option>
                        <option>Very Active</option>
                    </select>
                </div>
            </div>

            <button
                onClick={saveVitals}
                disabled={savingVitals}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors text-sm mb-4"
            >
                <Save size={15} />
                {savingVitals ? "Saving..." : "Save Vitals"}
            </button>

            {/* History */}
            {records.length > 0 && (
                <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Recent Readings</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {[...records].reverse().slice(0, 5).map(v => (
                            <div key={v.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                                <span>{v.heart_rate ? `❤️ ${v.heart_rate} BPM` : "—"}</span>
                                <span>{v.steps ? `👣 ${v.steps} steps` : "—"}</span>
                                <span className="text-slate-400">{v.activity_level}</span>
                                <span className="text-slate-400">{v.timestamp ? new Date(v.timestamp).toLocaleDateString() : ""}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
