import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import api from "src/lib/api";

interface UseFileUploadProps {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export function useFileUpload({ 
  maxSizeMB = 200, 
  allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"] 
}: UseFileUploadProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URL to prevent memory leaks
  const cleanupPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const selectFile = useCallback((selectedFile: File) => {
    setError(null);
    setIsSuccess(false);
    setProgress(0);

    // Validate file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(selectedFile.type)) {
      setError(`Invalid file type. Allowed formats: ${allowedTypes.join(", ")}`);
      return;
    }

    // Validate size limit (200MB)
    const sizeMB = selectedFile.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      setError(`File is too large. Max allowed size is ${maxSizeMB}MB.`);
      return;
    }

    cleanupPreview();
    setFile(selectedFile);
    
    // Create new object URL for client-side playback preview
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  }, [maxSizeMB, allowedTypes, cleanupPreview]);

  const reset = useCallback(() => {
    cleanupPreview();
    setFile(null);
    setProgress(0);
    setIsUploading(false);
    setIsSuccess(false);
    setError(null);
  }, [cleanupPreview]);

  const upload = useCallback(async (endpoint: string) => {
    if (!file) {
      setError("No file selected.");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Use the preconfigured api client but override content-type for multipart
      const response = await api.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
          }
        },
      });

      setIsSuccess(true);
      return response.data;
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to upload file. Please try again.";
      setError(errMsg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [file]);

  // Clean up resource when hook unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return {
    file,
    previewUrl,
    progress,
    isUploading,
    isSuccess,
    error,
    selectFile,
    upload,
    reset,
  };
}
