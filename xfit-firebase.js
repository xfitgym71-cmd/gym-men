import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyCSuQcor7jlagynFz9Yu6lf6A6YH4T7j94",
  authDomain: "x-fit-gym.firebaseapp.com",
  projectId: "x-fit-gym",
  storageBucket: "x-fit-gym.firebasestorage.app",
  messagingSenderId: "181984480415",
  appId: "1:181984480415:web:545afe5b97e1f95082a6aa"
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp };

/* الشيت هو المرجع للحجوزات: أي حجز قديم (أكتر من 3 دقايق) عند المشتركة وما بلاقيه السيرفر بالشيت
   (مثلاً الأدمن لغاه) بنمسحه من Firestore، وبنرجّع القائمة بدونه. أي خطأ = بنرجّع القائمة متل ما هي. */
const CHECK_API = "https://script.google.com/macros/s/AKfycbwZYnILlK_RNTeCv6l54kOqcgG1ZNxtR7DieFuPPQV0mXOdBl4jnlytY9ZwmTP8fvl1/exec";
export async function liveBookings(u, docs) {
  try {
    const now = Date.now(), pad = n => String(n).padStart(2, "0"), d0 = new Date();
    const today = d0.getFullYear() + "-" + pad(d0.getMonth() + 1) + "-" + pad(d0.getDate());
    const cand = docs.filter(d => {
      const x = d.data();
      if (!x || !x.key || x.cancelled || !(x.date >= today)) return false;
      const at = x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().getTime() : 0;
      return now - at > 180000;
    });
    if (!cand.length) return docs;
    const pr = await getDoc(doc(db, "users", u.uid)), p = pr.exists() ? pr.data() : {};
    if (!p.phone && !p.name) return docs;
    const idToken = await u.getIdToken();
    const res = await fetch(CHECK_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "myCheck", idToken, keys: cand.map(d => d.data().key).slice(0, 30), phone: p.phone || "", name: p.name || "" }) });
    const r = await res.json();
    if (!r || !r.ok || !Array.isArray(r.present)) return docs;
    const present = new Set(r.present), ghost = cand.filter(d => !present.has(d.data().key));
    await Promise.all(ghost.map(d => deleteDoc(d.ref).catch(() => {})));
    const gone = new Set(ghost.map(d => d.id));
    return docs.filter(d => !gone.has(d.id));
  } catch (e) { return docs; }
}
