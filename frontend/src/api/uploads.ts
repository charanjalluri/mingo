import { apiClient } from './client';

export interface UploadResult {
  url: string;
  filename: string;
  media_type: string;
  duration?: number;
}

export const uploadsApi = {
  uploadImage: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<UploadResult>('/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  uploadVoice: async (blob: Blob, durationSeconds?: number): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', blob, 'voice_recording.webm');
    if (durationSeconds) {
      formData.append('duration', durationSeconds.toString());
    }
    const res = await apiClient.post<UploadResult>('/uploads/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};
