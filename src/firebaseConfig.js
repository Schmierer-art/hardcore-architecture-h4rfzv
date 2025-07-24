// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcRiz6gVq7vE0duiy-t8dcbs9UOerrXW4",
  authDomain: "lehrerplan-fd7b4.firebaseapp.com",
  projectId: "lehrerplan-fd7b4",
  storageBucket: "lehrerplan-fd7b4.firebasestorage.app",
  messagingSenderId: "1064709676860",
  appId: "1:1064709676860:web:d4c3bd16da571eb4298839",
  measurementId: "G-1T3HYSLQ80",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
