"use client";

import { useEffect, useState } from "react";
import { Medicine, Reminder } from "@/types/schema";

interface Props {
    medicines: Medicine[];
    reminders: Reminder[];
}

export default function NotificationHandler({ medicines, reminders }: Props) {
    const [notifiedKeys, setNotifiedKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Request permission on mount
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const checkNotifications = () => {
            if (!("Notification" in window) || Notification.permission !== "granted") return;

            const now = new Date();
            const currentHourMinute = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const todayStr = now.toISOString().split('T')[0];

            // 1. Check Reminders
            reminders.forEach(r => {
                try {
                    // Assuming reminder_time is an ISO string or similar local datetime
                    const rDate = new Date(r.reminder_time);
                    const rTime = rDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    
                    // Logic for matching time:
                    // If it's a 'daily' reminder, match time.
                    // If 'weekly', match day of week + time.
                    // If 'none', match exact date + time.
                    
                    let timeMatches = rTime === currentHourMinute;
                    let dayMatches = true;

                    if (r.repeat_type === 'weekly') {
                        dayMatches = rDate.getDay() === now.getDay();
                    } else if (r.repeat_type === 'none') {
                        dayMatches = rDate.toISOString().split('T')[0] === todayStr;
                    }

                    if (timeMatches && dayMatches) {
                        const key = `reminder-${r.id}-${todayStr}-${currentHourMinute}`;
                        if (!notifiedKeys.has(key)) {
                            new Notification("⏰ Medication Reminder", {
                                body: `It's time for your scheduled reminder! Check your medicine list.`,
                                icon: "/favicon.ico",
                                tag: r.id // Prevents duplicate popups for same reminder
                            });
                            setNotifiedKeys(prev => new Set(prev).add(key));
                        }
                    }
                } catch (e) {
                    console.error("Error parsing reminder time:", e);
                }
            });

            // 2. Check Medicine Expiry
            medicines.forEach(m => {
                if (!m.expiry_date) return;
                try {
                    const expiryStr = m.expiry_date.split('T')[0];
                    if (expiryStr <= todayStr) {
                        const key = `expiry-${m.id}-${todayStr}`; // Notify once per day per medicine
                        if (!notifiedKeys.has(key)) {
                            const isExpired = expiryStr < todayStr;
                            new Notification(isExpired ? "🔴 Medicine Expired" : "⚠️ Medicine Expiring Today", {
                                body: `${m.name} ${isExpired ? 'has expired' : 'expires today'} (${expiryStr}). Please replace it.`,
                                icon: "/favicon.ico",
                                tag: `expiry-${m.id}`
                            });
                            setNotifiedKeys(prev => new Set(prev).add(key));
                        }
                    }
                } catch (e) {
                    console.error("Error checking expiry:", e);
                }
            });
        };

        // Check every 30 seconds to catch the minute transition
        const interval = setInterval(checkNotifications, 30000);
        checkNotifications(); // Immediate check on mount/update

        return () => clearInterval(interval);
    }, [medicines, reminders, notifiedKeys]);

    return null;
}
