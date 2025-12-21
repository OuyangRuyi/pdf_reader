import React, { useState, useEffect } from 'react';
import { getUserProfile, saveUserProfile } from '../services/api';
import { User, Save, X, Brain, Target, MessageSquare } from 'lucide-react';
import './ProfileModal.css';

const ProfileModal = ({ isOpen, onClose }) => {
  const [profile, setProfile] = useState({
    interests: [],
    focus_areas: [],
    custom_instructions: '',
    last_updated: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newFocusArea, setNewFocusArea] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      const data = await getUserProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await saveUserProfile(profile);
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile.' });
    } finally {
      setLoading(false);
    }
  };

  const addFocusArea = () => {
    if (newFocusArea.trim() && !profile.focus_areas.includes(newFocusArea.trim())) {
      setProfile({
        ...profile,
        focus_areas: [...profile.focus_areas, newFocusArea.trim()]
      });
      setNewFocusArea('');
    }
  };

  const removeFocusArea = (area) => {
    setProfile({
      ...profile,
      focus_areas: profile.focus_areas.filter(a => a !== area)
    });
  };

  const removeInterest = (interest) => {
    setProfile({
      ...profile,
      interests: profile.interests.filter(i => i !== interest)
    });
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal-content">
        <div className="profile-header">
          <h2>
            <User size={24} color="var(--primary)" />
            Personal Reading Memory
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="profile-subtitle">
          This profile helps the Agent understand your reading preferences and core interests.
          It is automatically updated based on your questions and used to personalize document summaries.
        </p>

        <div className="profile-body">
          {/* Interests Section (Auto-learned) */}
          <div className="profile-section">
            <h3>
              <Brain size={18} />
              Learned Interests
              <span className="section-hint">Automatically extracted from your questions</span>
            </h3>
            <div className="tags-container">
              {profile.interests.length > 0 ? (
                profile.interests.map((interest, index) => (
                  <span key={index} className="profile-tag interest-tag">
                    {interest}
                    <button onClick={() => removeInterest(interest)}><X size={12} /></button>
                  </span>
                ))
              ) : (
                <p className="empty-hint">No interests learned yet. Start chatting with the Agent!</p>
              )}
            </div>
          </div>

          {/* Focus Areas Section (Manual) */}
          <div className="profile-section">
            <h3>
              <Target size={18} />
              Core Focus Areas
              <span className="section-hint">What you care about most in research papers</span>
            </h3>
            <div className="tags-container">
              {profile.focus_areas.map((area, index) => (
                <span key={index} className="profile-tag focus-tag">
                  {area}
                  <button onClick={() => removeFocusArea(area)}><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="add-tag-input">
              <input 
                type="text" 
                value={newFocusArea} 
                onChange={(e) => setNewFocusArea(e.target.value)}
                placeholder="Add focus area (e.g. Methodology)"
                onKeyPress={(e) => e.key === 'Enter' && addFocusArea()}
              />
              <button onClick={addFocusArea}>Add</button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="profile-section">
            <h3>
              <MessageSquare size={18} />
              Custom Instructions
              <span className="section-hint">Specific preferences for how the Agent should summarize</span>
            </h3>
            <textarea 
              value={profile.custom_instructions}
              onChange={(e) => setProfile({...profile, custom_instructions: e.target.value})}
              placeholder="e.g. Always explain mathematical derivations in detail. Use simple language for experimental setups."
              rows={4}
            />
          </div>
        </div>

        {message.text && (
          <div className={`profile-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="profile-footer">
          <button className="save-profile-btn" onClick={handleSave} disabled={loading}>
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
