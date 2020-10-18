const admin = require("firebase-admin");
const bucket = admin.storage().bucket();


/* functions */
const upload = async (fileName, content) => {

    const file = bucket.file(fileName);
    await file.save(content);

}


/* exports */
module.exports = { upload, bucket }