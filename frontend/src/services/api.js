import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const uploadPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE_URL}/api/upload-pdf`, formData);
  return response.data;
};

export const getDocMeta = async (docId) => {
  const response = await axios.get(`${API_BASE_URL}/api/doc/${docId}`);
  return response.data;
};

export const runAgentTask = async (docId, page, taskType) => {
  const response = await axios.post(`${API_BASE_URL}/api/agent/run-task`, {
    doc_id: docId,
    page,
    task_type: taskType,
  });
  return response.data;
};

export const addNoteToDoc = async (docId, note) => {
  const response = await axios.post(`${API_BASE_URL}/api/doc/${docId}/notes`, note);
  return response.data;
};

export const initDocNotes = async (docId) => {
  const response = await axios.post(`${API_BASE_URL}/api/agent/init-notes`, { doc_id: docId });
  return response.data;
};

export const chatWithAgent = async (docId, page, question, history) => {
  const response = await axios.post(`${API_BASE_URL}/api/agent/chat`, {
    doc_id: docId,
    page,
    question,
    history
  });
  return response.data;
};

export const deleteNoteFromDoc = async (docId, noteId) => {
  const response = await axios.delete(`${API_BASE_URL}/api/doc/${docId}/notes/${noteId}`);
  return response.data;
};

export const getPdfUrl = (docId) => {
  return `${API_BASE_URL}/uploads/${docId}.pdf`;
};
