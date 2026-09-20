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

// 您的 Firebase UID（管理員帳戶）
// 登入後看到的是 Admin Panel，其他帳號看到的是 Client Dashboard
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "Za2Y2KDjDDVLI7qkHCyhqdfnrMu1";
