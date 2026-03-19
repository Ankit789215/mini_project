export interface Patient {
    id: string;
    user_id: string;
    patient_name: string;
    age: number | null;
    relation: string | null;
    email: string | null;
    created_at: string;
}

export interface Medicine {
    id: string;
    patient_id: string;
    name: string;
    dosage: string | null;
    frequency: string | null;
    expiry_date: string | null;
    created_at: string;
    days_to_expiry?: number | null;
}

export interface Reminder {
    id: string;
    patient_id: string;
    reminder_time: string;
    repeat_type: 'daily' | 'weekly' | 'monthly' | 'none';
    created_at: string;
}
