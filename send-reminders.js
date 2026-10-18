/* Xfit Gym – class reminders
   Runs every 5 minutes from GitHub Actions. Finds booked classes that start within the next
   60 minutes and sends the member a push notification (once per booking). */
const WINDOW_MIN = 60;       // send when the class starts within this many minutes
const SKIP_IF_BOOKED_WITHIN = 65; // booking made this close to the class: no reminder needed

/* pure logic (also used by the test) */
function pick(users, now) {
  const out = [];
  for (const u of users) {
    const sent = new Set(u.sent || []);
    for (const b of u.up || []) {
      if (!b || !b.key || !b.start || sent.has(b.key)) continue;
      const start = Date.parse(b.start);
      if (isNaN(start)) continue;
      const mins = Math.round((start - now) / 60000);
      if (mins <= 0 || mins > WINDOW_MIN) continue;
      const booked = b.at ? Date.parse(b.at) : NaN;
      const skip = !isNaN(booked) && start - booked < SKIP_IF_BOOKED_WITHIN * 60000;
      out.push({ uid: u.uid, push: u.push, lang: u.lang, b, mins, skip });
    }
  }
  return out;
}

function message(lang, b, mins) {
  if (lang === "en") {
    return { title: "Xfit Gym 💗", body: `${b.cls} starts at ${b.time} — in ${mins} min. Don't forget your workout! 💪`, lang: "en", dir: "ltr" };
  }
  return { title: "Xfit Gym 💗", body: `حصة ${b.cls} الساعة ${b.time} — بعد ${mins} دقيقة. لا تنسي التمرين! 💪`, lang: "ar", dir: "rtl" };
}

module.exports = { pick, message };

if (require.main === module) {
  (async () => {
    const admin = require("firebase-admin");
    const webpush = require("web-push");
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    webpush.setVapidDetails("https://alkayed03.github.io/x-fit-women99/", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const db = admin.firestore(), FV = admin.firestore.FieldValue;

    const snap = await db.collection("users").where("push", "!=", null).get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const jobs = pick(users, Date.now());
    console.log(`users with reminders on: ${users.length}, due now: ${jobs.length}`);

    for (const j of jobs) {
      const ref = db.collection("users").doc(j.uid);
      try {
        if (!j.skip) await webpush.sendNotification(j.push, JSON.stringify(Object.assign(message(j.lang, j.b, j.mins), { url: "./" })));
        await ref.update({ sent: FV.arrayUnion(j.b.key) });
        console.log(`${j.skip ? "skipped" : "sent"}: ${j.uid} ${j.b.key}`);
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await ref.update({ push: FV.delete() });
          console.log(`removed dead subscription: ${j.uid}`);
        } else console.log(`failed: ${j.uid} ${e.statusCode || e.message}`);
      }
    }
  })().catch(e => { console.error(e); process.exit(1); });
}
