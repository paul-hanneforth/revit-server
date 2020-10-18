/* imports */
const admin = require("firebase-admin");


/* functions */
const verifyIdToken = async (idToken) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch(e) {
        return null;
    }
}
const decodeToken = async (idToken) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch(e) {
        return null;
    }
}


/* exports */
module.exports = { verifyIdToken, decodeToken }