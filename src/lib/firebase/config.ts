import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBeL4LvDJZijAXw7k33F99T-LwS9_poiyo",
  authDomain: "cuponera-o2o.firebaseapp.com",
  projectId: "cuponera-o2o",
  storageBucket: "cuponera-o2o.firebasestorage.app",
  messagingSenderId: "632678345284",
  appId: "1:632678345284:web:e9e4baaa17bbebc13bea11"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
