"use client";

import { useEffect, useRef, useState } from "react";
import { Medicine, Reminder } from "@/types/schema";
import { Bell } from "lucide-react";

interface Props {
    medicines: Medicine[];
    reminders: Reminder[];
}

export default function NotificationHandler({ medicines, reminders }: Props) {
    const notifiedKeys = useRef<Set<string>>(new Set());
    const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

    // Request permission on mount
    useEffect(() => {
        if (!("Notification" in window)) return;
        setPermissionState(Notification.permission);
        if (Notification.permission === "default") {
            Notification.requestPermission().then(p => setPermissionState(p));
        }
    }, []);

    const requestPermission = async () => {
        const p = await Notification.requestPermission();
        setPermissionState(p);
    };

    useEffect(() => {
        const checkNotifications = () => {
            if (!("Notification" in window) || Notification.permission !== "granted") return;

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            // 1. Check Reminders — match within ±90 seconds of reminder time
            reminders.forEach(r => {
                try {
                    const rDate = new Date(r.reminder_time);
                    const diffMs = now.getTime() - rDate.getTime();

                    // Match if within 90 seconds after the scheduled time
                    let timeMatches = diffMs >= 0 && diffMs <= 90000;
                    let dayMatches = true;

                    if (r.repeat_type === 'daily') {
                        // For daily, compare hours and minutes only
                        timeMatches = Math.abs(
                            (now.getHours() * 60 + now.getMinutes()) -
                            (rDate.getHours() * 60 + rDate.getMinutes())
                        ) <= 1; // within 1 minute
                    } else if (r.repeat_type === 'weekly') {
                        dayMatches = rDate.getDay() === now.getDay();
                        timeMatches = Math.abs(
                            (now.getHours() * 60 + now.getMinutes()) -
                            (rDate.getHours() * 60 + rDate.getMinutes())
                        ) <= 1;
                    }
                    // r.repeat_type === 'none': use exact time match (diffMs check above)

                    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
                    const key = `reminder-${r.id}-${minuteKey}`;

                    if (timeMatches && dayMatches && !notifiedKeys.current.has(key)) {
                        notifiedKeys.current.add(key);
                        new Notification("⏰ Medication Reminder", {
                            body: `Time for your scheduled reminder! Check your medicine list.`,
                            icon: "/favicon.ico",
                            tag: `reminder-${r.id}-${minuteKey}`
                        });
                        console.log("Notification fired for reminder:", r.id);
                    }
                } catch (e) {
                    console.error("Error parsing reminder time:", r.reminder_time, e);
                }
            });

            // 2. Check Medicine Expiry (once per day per medicine)
            medicines.forEach(m => {
                if (!m.expiry_date) return;
                try {
                    const expiryStr = m.expiry_date.split('T')[0];
                    if (expiryStr <= todayStr) {
                        const key = `expiry-${m.id}-${todayStr}`;
                        if (!notifiedKeys.current.has(key)) {
                            notifiedKeys.current.add(key);
                            const isExpired = expiryStr < todayStr;
                            new Notification(isExpired ? "🔴 Medicine Expired" : "⚠️ Medicine Expiring Today", {
                                body: `${m.name} ${isExpired ? 'has expired' : 'expires today'} (${expiryStr}). Please replace it.`,
                                icon: "/favicon.ico",
                                tag: `expiry-${m.id}`
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error checking expiry:", e);
                }
            });
        };

        // Check every 30 seconds
        checkNotifications(); // Immediate check
        const interval = setInterval(checkNotifications, 30000);
        return () => clearInterval(interval);
    // Only re-run if medicines/reminders change — NOT on notifiedKeys change
    }, [medicines, reminders]);

    // Show a visible banner if permission not granted
    if (permissionState === "denied") {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                <Bell size={15} />
                Notifications are blocked. Enable them in browser settings to receive reminders.
            </div>
        );
    }

    if (permissionState === "default") {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm mb-4">
                <Bell size={15} />
                <span>Enable notifications to receive medication reminders.</span>
                <button
                    onClick={requestPermission}
                    className="ml-auto px-3 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600"
                >
                    Enable
                </button>
            </div>
        );
    }

    return null;
}
