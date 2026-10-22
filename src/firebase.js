import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Ambil nilai ini dari Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: "AIzaSyBFki276YgcGAL2G6xjI9f_NdVxR8HHj6A",
  authDomain: "portofoliomuammarnasution.firebaseapp.com",
  projectId: "portofoliomuammarnasution",
  storageBucket: "portofoliomuammarnasution.firebasestorage.app",
  messagingSenderId: "91640058973",
  appId: "1:91640058973:web:bd1906cde460bf4bc4e9b4",
  measurementId: "G-VN9LS59J4Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const configIsPlaceholder = firebaseConfig.apiKey.startsWith("GANTI_") || firebaseConfig.projectId.startsWith("GANTI_");
