import axios from 'axios';

const API_BASE_URL = '/api';

// Configure axios with appropriate timeout for AI operations
axios.defaults.timeout = 60000; // 60 seconds timeout for AI generation

export const uploadPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE_URL}/upload-pdf`, formData);
  return response.data;
};

export const getDocMeta = async (docId) => {
  const response = await axios.get(`${API_BASE_URL}/doc/${docId}`);
  return response.data;
};

export const runAgentTask = async (docId, page, taskType) => {
  const response = await axios.post(`${API_BASE_URL}/agent/run-task`, {
    doc_id: docId,
    page,
    task_type: taskType,
  });
  return response.data;
};

export const addNoteToDoc = async (docId, note) => {
  const response = await axios.post(`${API_BASE_URL}/doc/${docId}/notes`, note);
  return response.data;
};

export const initDocNotes = async (docId, type = 'both') => {
  const response = await axios.post(`${API_BASE_URL}/agent/init-notes`, { 
    doc_id: docId,
    type: type  // 'summary', 'diagram', or 'both' 
  });
  return response.data;
};

export const chatWithAgent = async (docId, page, question, history) => {
  const response = await axios.post(`${API_BASE_URL}/agent/chat`, {
    doc_id: docId,
    page,
    question,
    history
  });
  return response.data;
};

export const saveChatHistory = async (docId, history) => {
  const response = await axios.post(`${API_BASE_URL}/doc/${docId}/chat_history`, history);
  return response.data;
};

export const deleteChatMessage = async (docId, messageIndex) => {
  const response = await axios.delete(`${API_BASE_URL}/doc/${docId}/chat_history/${messageIndex}`);
  return response.data;
};

export const clearChatHistory = async (docId) => {
  const response = await axios.post(`${API_BASE_URL}/doc/${docId}/clear_chat`);
  return response.data;
};

export const deleteNoteFromDoc = async (docId, noteId) => {
  const response = await axios.delete(`${API_BASE_URL}/doc/${docId}/notes/${noteId}`);
  return response.data;
};

export const getPdfUrl = (docId) => {
  // 静态文件直接挂载在 /uploads 路径，不需要 /api 前缀
  return `/uploads/${docId}.pdf`;
};

// Model Management APIs
export const getAvailableModels = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/models`);
    console.log('getAvailableModels response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getAvailableModels error:', error);
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Backend server is not running');
    }
    throw new Error(`Failed to get available models: ${error.message}`);
  }
};

export const setCurrentModel = async (modelId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/models/set`, {
      model_id: modelId
    });
    console.log('setCurrentModel response:', response.data);
    return response.data;
  } catch (error) {
    console.error('setCurrentModel error:', error);
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Backend server is not running');
    }
    throw new Error(`Failed to set current model: ${error.message}`);
  }
};

export const getCurrentModel = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/models/current`);
    console.log('getCurrentModel response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getCurrentModel error:', error);
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Backend server is not running');
    }
    throw new Error(`Failed to get current model: ${error.message}`);
  }
};
