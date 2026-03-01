-- ============================================================
-- Family Health & Medication Manager — Supabase Schema & RLS
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Patients Table
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    age INTEGER,
    relation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);

-- 2. Medicines Table
CREATE TABLE public.medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medicines_patient_id ON public.medicines(patient_id);

-- 3. Reminders Table
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    reminder_time TIMESTAMPTZ NOT NULL,
    repeat_type TEXT check (repeat_type in ('daily', 'weekly', 'monthly', 'none')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON public.reminders(patient_id);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Patients: Users can fully manage their own patients
CREATE POLICY "Users can fully manage their own patients" 
    ON public.patients 
    FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Medicines: Users can fully manage medicines linked to their patients
CREATE POLICY "Users can fully manage medicines via patient ownership"
    ON public.medicines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.patients
            WHERE patients.id = medicines.patient_id
            AND patients.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patients
            WHERE patients.id = medicines.patient_id
            AND patients.user_id = auth.uid()
        )
    );

-- Reminders: Users can fully manage reminders linked to their patients
CREATE POLICY "Users can fully manage reminders via patient ownership"
    ON public.reminders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.patients
            WHERE patients.id = reminders.patient_id
            AND patients.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patients
            WHERE patients.id = reminders.patient_id
            AND patients.user_id = auth.uid()
        )
    );
