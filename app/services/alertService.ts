import { db } from '@/app/firebase/config';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { ALLOWED_ALERT_ACTIONS } from '../config'; // Import the allowed actions

let unsubscribe: Unsubscribe | null = null;

type AlertCallback = (alert: string | number) => void; // Allow number type for callback

export const startAlertService = (matchId: string, callback: AlertCallback): void => {
  // Stop any existing listener
  if (unsubscribe) {
    unsubscribe();
  }

  if (!matchId) {
    console.warn('Match ID is not provided for alert service.');
    return;
  }

  const docRef = doc(db, 'demo-scores', matchId);

  unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentAction = data?.last_action;

      // Check if last_action exists and is in the allowed list
      let shouldTriggerAlert = false;

      if (typeof currentAction === 'string') {
        if (currentAction.trim() !== '' && ALLOWED_ALERT_ACTIONS.includes(currentAction)) {
          shouldTriggerAlert = true;
        }
      } else if (typeof currentAction === 'number') {
         if (ALLOWED_ALERT_ACTIONS.includes(currentAction)) {
           shouldTriggerAlert = true;
         }
      }

      if (shouldTriggerAlert) {
        console.log('Action detected:', currentAction);
        callback(currentAction);
      }
    } else {
      console.log('No such document for match ID:', matchId);
    }
  }, (error) => {
    console.error('Error listening to demo-scores document:', error);
  });
};

export const stopAlertService = (): void => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log('Firebase listener stopped.');
  }
}; 