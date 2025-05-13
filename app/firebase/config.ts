import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4t8M6oswgKXf0JuF6KN5RVYYW82VZo9M",
  authDomain: "scoretickers.firebaseapp.com",
  projectId: "scoretickers",
  storageBucket: "scoretickers.firebasestorage.app",
  messagingSenderId: "438028124790",
  appId: "1:438028124790:web:a5c134921a2e94ba30d557",
  measurementId: "G-X9LTXBKBMN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db }; 