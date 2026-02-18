
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA3hV7eZwMBQerN1qLoxlKL0OgUXH0MEUU",
  authDomain: "pastelhojepode.firebaseapp.com",
  projectId: "pastelhojepode",
  storageBucket: "pastelhojepode.firebasestorage.app",
  messagingSenderId: "519166017118",
  appId: "1:519166017118:web:6234140f5602c3da2abecf"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
