/* initialize firebase */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");


/* functions */
const initializeApp = () => {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://revit-f67b2.firebaseio.com",
    storageBucket: "gs://revit-f67b2.appspot.com/"
  });
}


/* exports */
module.exports = { initializeApp }