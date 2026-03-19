const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Returns a configured fetch headers object containing the current user's JWT.
 */
function getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) throw new Error("No active session found");

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

export async function fetchPatients(limit: number = 20, offset: number = 0) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/patients?limit=${limit}&offset=${offset}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch patients");
    return res.json();
}

export async function createPatient(data: { patient_name: string; age?: number; relation?: string; email?: string }) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/patients`, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create patient");
    return res.json();
}

export async function deletePatient(id: string) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/patients/${id}`, { method: "DELETE", headers });
    if (!res.ok) throw new Error("Failed to delete patient");
}

export async function fetchMedicines(patientId: string, limit: number = 50, offset: number = 0) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/medicines/patient/${patientId}?limit=${limit}&offset=${offset}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch medicines");
    return res.json();
}

export async function createMedicine(data: { patient_id: string; name: string; dosage?: string; frequency?: string; expiry_date?: string }) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/medicines`, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create medicine");
    return res.json();
}

export async function deleteMedicine(id: string) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/medicines/${id}`, { method: "DELETE", headers });
    if (!res.ok) throw new Error("Failed to delete medicine");
}

export async function fetchReminders(patientId: string) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/reminders/patient/${patientId}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch reminders");
    return res.json();
}

export async function createReminder(data: { patient_id: string; reminder_time: string; repeat_type: string }) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/reminders`, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create reminder");
    return res.json();
}

export async function deleteReminder(id: string) {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/reminders/${id}`, { method: "DELETE", headers });
    if (!res.ok) throw new Error("Failed to delete reminder");
}
