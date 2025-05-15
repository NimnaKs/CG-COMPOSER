'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase/config';
import { collection, doc, getDoc, updateDoc, addDoc, query, orderBy, limit, getDocs, setDoc } from 'firebase/firestore';
import { startAlertService, stopAlertService } from './services/alertService';
import MatchSelectionModal from './components/MatchSelectionModal';
import { BASE_URL, URL_PATHS, ALLOWED_ALERT_ACTIONS } from './config';
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
  message: string | number;
  timestamp: number;
}

interface HistoryItem {
  action: string | number;
  mode: string;
  timestamp: number;
  matchId: string;
}

interface HistoryState {
  items: HistoryItem[];
  loading: boolean;
}

// Mapping from ALLOWED_ALERT_ACTIONS values to Firebase document keys
const actionToDocKey: { [key: string | number]: string } = {
  4: 'four',
  6: 'six',
  'WINNER': 'winner',
  'WICKET': 'wicket',
  'RETIREMENT': 'retirement',
  'NEXT_PLAYER': 'nextPlayer',
  'HALF_TIME': 'halfTime',
  'BATTING_INTRO': 'battingIntro',
  'SCORE_TABLE': 'scoreTable',
  'INNING_TABLE': 'inningTable',
  'TOSS': 'toss',
  'PLAYER_SUMMARY': 'playerSummary',
  'wideDelivery': 'wideDelivery',
  'freeHit': 'freeHit',
  'scoreTicker': 'scoreTicker'
};

// List of all potential document keys we might interact with (for loading data)
const allPotentialDocKeys = Object.values(actionToDocKey);

// Add a function to get short names for buttons
const getShortName = (actionValue: string | number): string => {
  const shortNames: { [key: string]: string } = {
    'WINNER': 'Win',
    'WICKET': 'Wkt',
    'RETIREMENT': 'Ret',
    'NEXT_PLAYER': 'Next',
    'HALF_TIME': 'Half',
    'BATTING_INTRO': 'Bat',
    'SCORE_TABLE': 'Score',
    'INNING_TABLE': 'Inn',
    'TOSS': 'Toss',
    'PLAYER_SUMMARY': 'Player',
    'wideDelivery': 'Wide',
    'freeHit': 'Free'
  };

  if (typeof actionValue === 'number') {
    return actionValue.toString();
  }
  return shortNames[actionValue] || actionValue;
};

export default function ComposerPage() {
  const [previewDocs, setPreviewDocs] = useState<DocsState>({});
  const [liveDocs, setLiveDocs] = useState<DocsState>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [matchId, setMatchId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [history, setHistory] = useState<HistoryState>({
    items: [],
    loading: false
  });

  // Construct URLs based on matchId
  const previewUrl = matchId ? `${BASE_URL}${URL_PATHS.PREVIEW}${matchId}` : 'about:blank';
  const liveUrl = matchId ? `${BASE_URL}${URL_PATHS.LIVE}${matchId}` : 'about:blank';

  const loadDocuments = useCallback(async (mode: string): Promise<DocsState> => {
    const collectionRef = collection(db, mode);
    const docs: DocsState = {};

    // Fetch data for all potential document keys
    for (const key of allPotentialDocKeys) {
      const docRef = doc(collectionRef, key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        docs[key] = docSnap.data() as DocData;
      }
    }
    return docs;
  }, [matchId]);

  // Load history for current match
  const loadHistory = useCallback(async () => {
    if (!matchId) return;

    setHistory(prev => ({ ...prev, loading: true }));
    try {
      const historyRef = collection(db, 'composer-history');
      const q = query(
        historyRef,
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const historyItems: HistoryItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as HistoryItem;
        if (data.matchId === matchId) {
          historyItems.push(data);
        }
      });
      
      setHistory({
        items: historyItems,
        loading: false
      });
    } catch (error) {
      console.error('Error loading history:', error);
      setHistory(prev => ({ ...prev, loading: false }));
    }
  }, [matchId]);

  useEffect(() => {
    // Only load documents and start alert service when a match is selected
    if (!matchId) return;

    const initializeDocs = async () => {
      const previewData = await loadDocuments('preview');
      const liveData = await loadDocuments('live');
      setPreviewDocs(previewData);
      setLiveDocs(liveData);
    };

    initializeDocs();

    // Start the alert service, passing the matchId
    startAlertService(matchId, (message: string | number) => {
      setAlerts(prev => {
        const newAlert = {
          id: Math.random().toString(36).substr(2, 9),
          message: typeof message === 'number' ? String(message) : message, // Ensure message is string for display
          timestamp: Date.now()
        };
        const newAlerts = [newAlert, ...prev];
        // Keep only the last 5 alerts
        return newAlerts.slice(0, 5);
      });
    });

    // Cleanup function
    return () => {
      stopAlertService();
    };
  }, [matchId, loadDocuments]);

  useEffect(() => {
    if (matchId) {
      loadHistory();
    }
  }, [matchId, loadHistory]);

  const handleButtonClick = async (actionValue: string | number, mode: string) => {
    console.log('Button clicked:', { actionValue, mode });
    
    if (!matchId) {
      console.log('No matchId found');
      return;
    }

    const docKey = actionToDocKey[actionValue];
    if (!docKey) {
      console.error(`No document key found for action: ${actionValue}`);
      return;
    }

    try {
      console.log('Starting update process...', { docKey, matchId });

      // 1. Update or create the control state in preview/live collection
      const collectionRef = collection(db, mode);
      const docRef = doc(collectionRef, docKey);
      const docSnap = await getDoc(docRef);

      console.log('Checking document existence:', docSnap.exists());

      let newControl = true; // Default to true when creating new document

      if (docSnap.exists()) {
        const currentData = docSnap.data() as DocData;
        newControl = !currentData.control;
        console.log('Current control state:', { 
          currentControl: currentData.control,
          newControl,
          docKey
        });
      }

      // Update the control document
      await setDoc(docRef, {
        control: newControl,
        lastUpdated: new Date().toISOString()
      });

      // 2. Update match score collection
      console.log('Updating match score for:', matchId);
      const matchScoreRef = doc(db, 'demo-scores', matchId);
      const matchScoreSnap = await getDoc(matchScoreRef);
      
      if (!matchScoreSnap.exists()) {
        console.error('Match document not found:', matchId);
        return;
      }

      const updateField = mode === 'preview' ? 'ticker_preview' : 'ticker_live';
      
      // Handle different types of values
      let tickerValue: string | number = '';
      if (newControl) {
        if (actionValue === 4 || actionValue === 6) {
          tickerValue = Number(actionValue);
        } else if (typeof actionValue === 'string') {
          tickerValue = actionValue;
        }
      }

      // Update match score document
      const updateData = {
        [updateField]: tickerValue,
        lastUpdated: new Date().toISOString()
      };

      console.log('Updating match score document with:', updateData);
      await updateDoc(matchScoreRef, updateData);

      // 3. Update sticker collection
      const stickerRef = doc(db, `${mode}-stickers`, matchId);
      const stickerData = {
        type: actionValue,
        active: newControl,
        lastUpdated: new Date().toISOString()
      };

      console.log('Updating sticker document:', stickerData);
      await setDoc(stickerRef, stickerData);

      // 4. Add to history
      console.log('Adding to history...');
      const historyRef = collection(db, 'composer-history');
      await addDoc(historyRef, {
        action: tickerValue || actionValue,
        mode,
        timestamp: Date.now(),
        matchId
      });

      // 5. Refresh the documents and history
      console.log('Refreshing documents and history...');
      const updatedDocs = await loadDocuments(mode);
      if (mode === 'preview') {
        setPreviewDocs(updatedDocs);
      } else {
        setLiveDocs(updatedDocs);
      }
      loadHistory();

      // 6. Verify the updates
      const verifySnap = await getDoc(matchScoreRef);
      const verifyStickerSnap = await getDoc(stickerRef);
      console.log('Final verification - Updated match data:', verifySnap.data());
      console.log('Final verification - Updated sticker data:', verifyStickerSnap.data());

    } catch (error) {
      console.error('Error in handleButtonClick:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
    }
  };

  const handleMatchSelect = (selectedMatchId: string) => {
    setMatchId(selectedMatchId);
    setIsModalOpen(false);
  };

  const handleAlertAction = (alertId: string, action: 'complete' | 'dismiss') => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <h1>Cricket Graphics Composer</h1>
        <button className={styles.changeMatchButton} onClick={() => setIsModalOpen(true)}>
          Change Match
        </button>
      </header>

      {!matchId ? (
        <div className={styles.emptyState}>
          <p>Please select a match to continue</p>
        </div>
      ) : (
        <>
          <div className={styles.mainContent}>
            <div className={styles.screensContainer}>
              <div className={styles.screen}>
                <h2>Preview</h2>
                <iframe
                  src={previewUrl}
                  title="Preview Screen"
                  className={styles.screenIframe}
                  scrolling="no"
                  allowFullScreen
                />
                <div className={styles.controls}>
                  {ALLOWED_ALERT_ACTIONS.map((actionValue, index) => {
                    const docKey = actionToDocKey[actionValue];
                    const isActive = docKey ? previewDocs[docKey]?.control : false;

                    return (
                      <button
                        key={String(actionValue)}
                        className={`${styles.controlButton} ${isActive ? styles.active : ''}`}
                        onClick={() => {
                          console.log('Button clicked in UI:', { actionValue, mode: 'preview' });
                          handleButtonClick(actionValue, 'preview');
                        }}
                        title={String(actionValue).charAt(0).toUpperCase() + String(actionValue).slice(1)}
                      >
                        <span className={styles.buttonNumber}>{index + 1}</span>
                        {getShortName(actionValue)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.screen}>
                <h2>Live</h2>
                <iframe
                  src={liveUrl}
                  title="Live Screen"
                  className={styles.screenIframe}
                  scrolling="no"
                  allowFullScreen
                />
                <div className={styles.controls}>
                  {ALLOWED_ALERT_ACTIONS.map((actionValue, index) => {
                    const docKey = actionToDocKey[actionValue];
                    const isActive = docKey ? liveDocs[docKey]?.control : false;

                    return (
                      <button
                        key={String(actionValue)}
                        className={`${styles.controlButton} ${isActive ? styles.active : ''}`}
                        onClick={() => {
                          console.log('Button clicked in UI:', { actionValue, mode: 'live' });
                          handleButtonClick(actionValue, 'live');
                        }}
                        title={String(actionValue).charAt(0).toUpperCase() + String(actionValue).slice(1)}
                      >
                        <span className={styles.buttonNumber}>{index + 1}</span>
                        {getShortName(actionValue)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={styles.historyPanel}>
              <h3>Action History</h3>
              {history.loading ? (
                <div className={styles.historyLoading}>Loading history...</div>
              ) : history.items.length === 0 ? (
                <div className={styles.historyEmpty}>No actions recorded yet</div>
              ) : (
                <div className={styles.historyList}>
                  {history.items.map((item, index) => (
                    <div key={index} className={styles.historyItem}>
                      <div className={styles.historyAction}>
                        <span className={`${styles.historyMode} ${styles[item.mode]}`}>
                          {item.mode}
                        </span>
                        {String(item.action)}
                      </div>
                      <div className={styles.historyTime}>
                        {formatTimeAgo(item.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
        </>
      )}

      <MatchSelectionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleMatchSelect}
      />
    </div>
  );
}
