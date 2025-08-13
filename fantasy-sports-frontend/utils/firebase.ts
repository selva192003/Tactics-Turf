// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDg3JXXZAgSfnb_2qUXY9UIM3uOxPliFS0",
  authDomain: "dream11-6ed51.firebaseapp.com",
  projectId: "dream11-6ed51",
  storageBucket: "dream11-6ed51.firebasestorage.app",
  messagingSenderId: "454286716062",
  appId: "1:454286716062:web:c7e97a5957fb03672e1f8f",
  measurementId: "G-5G797X21ZF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);