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

export const runAgentTask = async (docId, page, taskType, signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/run-task`, {
    doc_id: docId,
    page,
    task_type: taskType,
  }, { signal });
  return response.data;
};

export const addNoteToDoc = async (docId, note) => {
  const response = await axios.post(`${API_BASE_URL}/doc/${docId}/notes`, note);
  return response.data;
};

export const initDocNotes = async (docId, type = 'both', signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/init-notes`, {
    doc_id: docId,
    type: type  // 'summary', 'diagram', or 'both' 
  }, { signal });
  return response.data;
};

export const chatWithAgent = async (docId, page, question, history, signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/chat`, {
    doc_id: docId,
    page,
    question,
    history
  }, { signal });
  return response.data;
};
export const activeReading = async (docId, page, signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/active-reading`, {
    doc_id: docId,
    page
  }, { signal });
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

export const updateNoteInDoc = async (docId, noteId, note) => {
  const response = await axios.put(`${API_BASE_URL}/doc/${docId}/notes/${noteId}`, note);
  return response.data;
};

export const getPdfUrl = (docId) => {
  // 静态文件直接挂载在 /uploads 路径，不需要 /api 前缀
  return `/uploads/${docId}.pdf`;
};

// Model Management APIs
export const getDocToc = async (docId) => {
  const response = await axios.get(`${API_BASE_URL}/docs/${docId}/toc`);
  return response.data;
};

export const getDocFigures = async (docId) => {
  const response = await axios.get(`${API_BASE_URL}/docs/${docId}/figures`);
  return response.data;
};

export const resolveReference = async (docId, refText) => {
  const response = await axios.post(`${API_BASE_URL}/docs/resolve-reference`, {
    doc_id: docId,
    ref_text: refText
  });
  return response.data;
};

export const skimPaper = async (docId, signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/skim`, {
    doc_id: docId
  }, { signal });
  return response.data;
};

export const analyzeFigure = async (docId, figureData, signal) => {
  const response = await axios.post(`${API_BASE_URL}/agent/analyze-figure`, {
    doc_id: docId,
    figure_data: figureData
  }, { signal });
  return response.data;
};

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

// RAG 相关 API（新增）
export const uploadAndEmbed = async (files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  const response = await axios.post(`${API_BASE_URL}/upload-and-embed`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 分钟超时（embedding 生成可能需要较长时间）
  });
  return response.data;
};

export const ragQuery = async (question, signal) => {
  const response = await axios.post(`${API_BASE_URL}/rag-query`, {
    question
  }, { signal });
  return response.data;
};

export const embedDocument = async (docId) => {
  const response = await axios.post(`${API_BASE_URL}/doc/${docId}/embed`);
  return response.data;
};

export const getUploadedFiles = async () => {
  const response = await axios.get(`${API_BASE_URL}/uploaded-files`);
  return response.data;
};

export const deleteDocument = async (docId) => {
  const response = await axios.delete(`${API_BASE_URL}/doc/${docId}`);
  return response.data;
};

// Config APIs
export const getConfigStatus = async () => {
  const response = await axios.get(`${API_BASE_URL}/config/status`);
  return response.data;
};

export const saveConfig = async (config) => {
  const response = await axios.post(`${API_BASE_URL}/config/save`, config);
  return response.data;
};

// User Profile APIs
export const getUserProfile = async () => {
  const response = await axios.get(`${API_BASE_URL}/user/profile`);
  return response.data;
};

export const saveUserProfile = async (profile) => {
  const response = await axios.post(`${API_BASE_URL}/user/profile`, profile);
  return response.data;
};
