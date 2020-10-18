/* initialize firebase */
const admin = require("firebase-admin");


/* setup db */
const db = admin.firestore();


/* exports */
module.exports = db;