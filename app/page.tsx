'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase/config';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { startAlertService, stopAlertService } from './services/alertService';
import styles from './page.module.css';

interface DocData {
  control: boolean;
  lastUpdated: string;
  title?: string;
}

interface DocsState {
  [key: string]: DocData;
}

interface Alert {
  id: string;
  message: string;
  timestamp: number;
}

export default function ComposerPage() {
  const [previewDocs, setPreviewDocs] = useState<DocsState>({});
  const [liveDocs, setLiveDocs] = useState<DocsState>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>('about:blank');
  const [liveUrl, setLiveUrl] = useState<string>('about:blank');

  const loadDocuments = async (mode: string): Promise<DocsState> => {
    const collectionRef = collection(db, mode);
    const types = ['four', 'six', 'wicket', 'wideDelivery', 'freeHit', 'scoreTicker', 'common'];
    const docs: DocsState = {};

    for (const type of types) {
      const docRef = doc(collectionRef, type);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        docs[type] = docSnap.data() as DocData;
      }
    }

    return docs;
  };

  useEffect(() => {
    const initializeDocs = async () => {
      const previewData = await loadDocuments('preview');
      const liveData = await loadDocuments('live');
      setPreviewDocs(previewData);
      setLiveDocs(liveData);
    };

    initializeDocs();

    // Start the alert service
    const alertInterval = startAlertService((message: string) => {
      setAlerts(prev => {
        const newAlert = {
          id: Math.random().toString(36).substr(2, 9),
          message,
          timestamp: Date.now()
        };
        const newAlerts = [newAlert, ...prev];
        // Keep only the last 5 alerts
        return newAlerts.slice(0, 5);
      });
    });

    // Cleanup function
    return () => {
      stopAlertService(alertInterval);
    };
  }, []);

  const handleButtonClick = async (type: string, mode: string) => {
    const collectionRef = collection(db, mode);
    const docRef = doc(collectionRef, type);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const currentData = docSnap.data() as DocData;
      const newControl = !currentData.control;
      
      await updateDoc(docRef, {
        control: newControl,
        lastUpdated: new Date().toISOString()
      });

      // Refresh the documents
      const updatedDocs = await loadDocuments(mode);
      if (mode === 'preview') {
        setPreviewDocs(updatedDocs);
      } else {
        setLiveDocs(updatedDocs);
      }
    }
  };

  const updateCommonTitle = async (mode: string) => {
    // Get the current document reference based on mode
    const currentRef = doc(collection(db, mode), 'common');
    const otherRef = doc(collection(db, mode === 'preview' ? 'live' : 'preview'), 'common');
    
    // Get current document data
    const docSnap = await getDoc(currentRef);
    
    if (docSnap.exists()) {
      const currentData = docSnap.data() as DocData;
      
      // Only prompt for title if control is false
      if (!currentData.control) {
        const newTitle = prompt('Enter new title:');
        if (newTitle) {
          // Update title in both documents but control only in clicked side
          const currentUpdate = {
            title: newTitle,
            control: true,
            lastUpdated: new Date().toISOString()
          };

          const otherUpdate = {
            title: newTitle,
            lastUpdated: new Date().toISOString()
          };

          // Update both documents
          await updateDoc(currentRef, currentUpdate);
          await updateDoc(otherRef, otherUpdate);
        }
      } else {
        // If control is true, just set it to false
        await updateDoc(currentRef, {
          control: false,
          lastUpdated: new Date().toISOString()
        });
      }

      // Refresh both collections
      const updatedPreviewDocs = await loadDocuments('preview');
      const updatedLiveDocs = await loadDocuments('live');
      setPreviewDocs(updatedPreviewDocs);
      setLiveDocs(updatedLiveDocs);
    }
  };

  const handleUrlChange = (mode: string) => {
    const url = prompt(`Enter URL for ${mode} screen:`);
    if (url) {
      if (mode === 'preview') {
        setPreviewUrl(url);
      } else {
        setLiveUrl(url);
      }
    }
  };

  const handleAlertAction = (alertId: string, action: 'complete' | 'dismiss') => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  return (
    <main className={styles.appContainer}>
      <div className={styles.header}>
        <h1>Sports Graphics CMS</h1>
      </div>

      <div className={styles.screensContainer}>
        <div className={styles.screen}>
          <h2>Preview</h2>
          <div className={styles.urlBar}>
            <input 
              type="text" 
              value={previewUrl} 
              readOnly 
              className={styles.urlInput}
            />
            <button 
              className={styles.urlButton}
              onClick={() => handleUrlChange('preview')}
            >
              Change URL
            </button>
          </div>
          <iframe
            src={previewUrl}
            title="Preview Screen"
            className={styles.screenIframe}
          />
          <div className={styles.controls}>
            {Object.keys(previewDocs).map((type, index) => (
              <button
                key={type}
                className={`${styles.controlButton} ${previewDocs[type]?.control ? styles.active : ''}`}
                onClick={() => type === 'common' ? updateCommonTitle('preview') : handleButtonClick(type, 'preview')}
              >
                <span className={styles.buttonNumber}>{index + 1}</span>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles.screen}>
          <h2>Live</h2>
          <div className={styles.urlBar}>
            <input 
              type="text" 
              value={liveUrl} 
              readOnly 
              className={styles.urlInput}
            />
            <button 
              className={styles.urlButton}
              onClick={() => handleUrlChange('live')}
            >
              Change URL
            </button>
          </div>
          <iframe
            src={liveUrl}
            title="Live Screen"
            className={styles.screenIframe}
          />
          <div className={styles.controls}>
            {Object.keys(liveDocs).map((type, index) => (
              <button
                key={type}
                className={`${styles.controlButton} ${liveDocs[type]?.control ? styles.active : ''}`}
                onClick={() => type === 'common' ? updateCommonTitle('live') : handleButtonClick(type, 'live')}
              >
                <span className={styles.buttonNumber}>{index + 1}</span>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.alertsContainer}>
          {alerts.map((alert) => (
            <div key={alert.id} className={styles.alertItem}>
              <span>{alert.message}</span>
              <div className={styles.alertActions}>
                <button
                  className={`${styles.alertAction} ${styles.complete}`}
                  onClick={() => handleAlertAction(alert.id, 'complete')}
                  title="Mark as complete"
                >
                  ✓
                </button>
                <button
                  className={`${styles.alertAction} ${styles.dismiss}`}
                  onClick={() => handleAlertAction(alert.id, 'dismiss')}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
