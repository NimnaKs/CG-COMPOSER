'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import styles from './MatchSelectionModal.module.css';

interface Match {
  id: string;
  matchTitle: string;
  location: string;
  matchTime: string;
  team1: {
    id: string;
    imageUrl: string;
  };
  team2: {
    id: string;
    imageUrl: string;
  };
  tournamentTitle: {
    id: string;
    imageUrl: string;
  };
}

interface MatchSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (matchId: string) => void;
}

export default function MatchSelectionModal({ isOpen, onClose, onSelect }: MatchSelectionModalProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const matchesCollection = collection(db, 'demo-matches');
        const matchesSnapshot = await getDocs(matchesCollection);
        
        const matchesList: Match[] = [];
        matchesSnapshot.forEach((doc) => {
          matchesList.push({ id: doc.id, ...doc.data() } as Match);
        });
        
        setMatches(matchesList);
        setError(null);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Failed to load matches. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Select a Match</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalContent}>
          {loading ? (
            <div className={styles.loading}>Loading matches...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : matches.length === 0 ? (
            <div className={styles.empty}>No matches found.</div>
          ) : (
            <ul className={styles.matchList}>
              {matches.map((match) => (
                <li key={match.id} className={styles.matchItem} onClick={() => onSelect(match.id)}>
                  <div className={styles.matchDetails}>
                    <div className={styles.matchTitle}>{match.matchTitle}</div>
                    <div className={styles.matchInfo}>
                      <span>{match.location}</span>
                      <span>•</span>
                      <span>{new Date(match.matchTime).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.tournamentTitle}>{match.tournamentTitle.id}</div>
                  </div>
                  <div className={styles.teams}>
                    <div className={styles.team}>
                      <div className={styles.teamId}>{match.team1.id}</div>
                    </div>
                    <div className={styles.vs}>VS</div>
                    <div className={styles.team}>
                      <div className={styles.teamId}>{match.team2.id}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 