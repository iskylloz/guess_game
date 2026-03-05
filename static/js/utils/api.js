/**
 * Centralized API client for all backend communication.
 */
const API = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `GET ${url}: ${res.status}`);
        }
        return res.json();
    },

    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `POST ${url}: ${res.status}`);
        }
        return res.json();
    },

    async postFormData(url, formData) {
        const res = await fetch(url, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `POST ${url}: ${res.status}`);
        }
        return res.json();
    },

    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `PUT ${url}: ${res.status}`);
        }
        return res.json();
    },

    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `DELETE ${url}: ${res.status}`);
        }
        return res.json();
    },

    /**
     * Upload a file to the server.
     * @param {string} url - Upload endpoint
     * @param {File|Blob} file - File to upload
     * @param {string} fieldName - Form field name (default 'file')
     */
    async uploadFile(url, file, fieldName = 'file') {
        const formData = new FormData();
        formData.append(fieldName, file);
        return this.postFormData(url, formData);
    },

    /**
     * Download export as blob.
     */
    async downloadBlob(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
    }
};
