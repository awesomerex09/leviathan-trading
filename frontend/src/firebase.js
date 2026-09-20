import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpLSEn3n4lJc3ROsstsBEBOtX8gDqkYqg",
  authDomain: "autolvis.firebaseapp.com",
  projectId: "autolvis",
  storageBucket: "autolvis.firebasestorage.app",
  messagingSenderId: "306680541170",
  appId: "1:306680541170:web:9e8aeef1d6f5de87abc56b",
  measurementId: "G-9SLJNM2YV2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 後端 API 基礎 URL（本地開發時指向 localhost）
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// 您的 Firebase UID（用來判斷是否顯示 Admin 入口）
// 部署前請改為真實的 Admin UID，或從環境變數讀取
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "SET_YOUR_ADMIN_UID_HERE";
