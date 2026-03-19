"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Footprints, Activity, Save, Camera, Loader2, Trash2 } from "lucide-react";
import { deleteVital } from "@/lib/api";

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
    const [fingerDetected, setFingerDetected] = useState(false);
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
            setFingerDetected(false);

            const samples: number[] = [];
            const DURATION = 15000;
            let measureStart: number | null = null; // Start countdown only after finger is on
            let waitingForFinger = true;

            const ctx = canvasRef.current?.getContext("2d");

            const tick = () => {
                if (!streamRef.current || !ctx || !videoRef.current || !canvasRef.current) return;
                
                ctx.drawImage(videoRef.current, 0, 0, 20, 20);
                const pixel = ctx.getImageData(0, 0, 20, 20).data;
                
                let rTotal = 0, gTotal = 0, bTotal = 0;
                const count = pixel.length / 4;
                for (let i = 0; i < pixel.length; i += 4) {
                    rTotal += pixel[i];
                    gTotal += pixel[i + 1];
                    bTotal += pixel[i + 2];
                }
                const meanR = rTotal / count;
                const meanG = gTotal / count;
                const meanB = bTotal / count;

                // Finger detection: flesh over camera makes red channel dominant and bright
                // Relaxed threshold to detect finger more easily in various lighting conditions
                const hasFingerNow = meanR > 60 && meanR > meanG * 1.2 && meanR > meanB * 1.3;
                setFingerDetected(hasFingerNow);

                if (waitingForFinger) {
                    if (hasFingerNow) {
                        waitingForFinger = false;
                        measureStart = Date.now();
                    }
                    requestAnimationFrame(tick);
                    return;
                }

                // Once finger is placed, start measuring
                samples.push(meanR);
                const elapsed = Date.now() - (measureStart ?? Date.now());
                setPpgProgress(Math.min(100, (elapsed / DURATION) * 100));

                if (!hasFingerNow) {
                    // Finger lifted midway — reset
                    waitingForFinger = true;
                    measureStart = null;
                    samples.length = 0;
                    setPpgProgress(0);
                }

                if (elapsed < DURATION) {
                    requestAnimationFrame(tick);
                } else {
                    stopCamera();
                    if (samples.length > 50) {
                        // Estimate actual capture frame rate
                        const fps = samples.length / (DURATION / 1000);
                        // Min frames between peaks = ~0.4s at actual fps (avoids counting noise)
                        const minPeakGap = Math.max(4, Math.round(fps * 0.4));

                        // Smooth with a moving average of 7 frames
                        const smoothed: number[] = [];
                        for (let i = 3; i < samples.length - 3; i++) {
                            smoothed.push(
                                (samples[i-3] + samples[i-2] + samples[i-1] + samples[i] +
                                 samples[i+1] + samples[i+2] + samples[i+3]) / 7
                            );
                        }
                        const mean = smoothed.reduce((a, b) => a + b) / smoothed.length;
                        // Only count peaks that are significantly above mean
                        const threshold = mean * 1.005;
                        let peaks = 0;
                        let lastPeakIndex = -minPeakGap;
                        for (let i = 1; i < smoothed.length - 1; i++) {
                            if (smoothed[i] > threshold &&
                                smoothed[i] > smoothed[i - 1] &&
                                smoothed[i] > smoothed[i + 1] &&
                                (i - lastPeakIndex) > minPeakGap) {
                                peaks++;
                                lastPeakIndex = i;
                            }
                        }
                        const bpm = Math.round((peaks / (DURATION / 1000)) * 60);
                        console.log(`BPM calculation: peaks=${peaks}, fps=${fps.toFixed(1)}, bpm=${bpm}`);
                        // Only accept readings in a realistic human heart rate range
                        if (bpm >= 40 && bpm <= 200) {
                            setHr(bpm);
                        } else {
                            // Unrealistic result — bad finger placement
                            alert(`Reading of ${bpm} BPM is outside the expected range. Please ensure your finger fully covers the camera and try again.`);
                        }
                    } else {
                        alert("Not enough data collected. Please keep your finger on the camera for the full 15 seconds.");
                    }
                }
            };
            requestAnimationFrame(tick);
        } catch {
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
            setHr(null); setSteps(""); setActivity("Moderate");
        } catch { } finally { setSavingVitals(false); }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm("Delete this vital record?")) return;
        try {
            await deleteVital(id);
            setRecords(prev => prev.filter(r => r.id !== id));
        } catch {
            alert("Failed to delete record.");
        }
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
                {/* Video MUST NOT be display:none — use visibility:hidden so canvas can draw from it */}
                <video ref={videoRef} style={{ visibility: "hidden", position: "absolute", width: 1, height: 1 }} muted playsInline />
                <canvas ref={canvasRef} width={20} height={20} style={{ visibility: "hidden", position: "absolute", width: 1, height: 1 }} />

                {measuring && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mb-2 ${
                        fingerDetected
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                        {fingerDetected
                            ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" /> Finger detected — hold steady...</>
                            : <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" /> 👆 Place your finger firmly on the camera</>
                        }
                    </div>
                )}

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
                            <div key={v.id} className="group flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors">
                                <div className="flex gap-3">
                                    <span>{v.heart_rate ? `❤️ ${v.heart_rate} BPM` : "—"}</span>
                                    <span>{v.steps ? `👣 ${v.steps} steps` : "—"}</span>
                                    <span className="text-slate-400">{v.activity_level}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">{v.timestamp ? new Date(v.timestamp).toLocaleDateString() : ""}</span>
                                    <button
                                        onClick={() => handleDeleteRecord(v.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Record"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
