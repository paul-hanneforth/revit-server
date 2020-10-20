/* imports */
const router = require("express").Router();
const { errorMessage } = require("./error.js");
const auth = require("./firebase/auth.js");
const storage = require("./firebase/storage.js");
const util = require("./util.js");


/* config */
const version = "v0.0.4";


// enable automatic logging of reads, writes and deletes
setInterval(() => console.log(util.logger.export()), 1000 * 60);


/* functions */
const isComplete = (obj) => {

    const keysObj = Object.keys(obj);
    return keysObj.reduce((acc, value) => {

        if (acc == false) return false;
        if (obj[value] == undefined || obj[value] == null) return false;
        return true;

    }, true)

}


/* routes */
router.get("/ping", (req, res) => {
    res.json({
        error: false,
        message: "Ping was successfull!",
        version
    }); 
})
router.post("/ping", (req, res) => {
    res.json({
        error: false,
        message: "Ping was successfull!",
        version
    });
});

router.post("/profile/add", async (req, res) => {
    /* 
    Total cost:
    - Reads: max. 1
    - Writes: 1
    */

    const idToken = req.body.idToken;
    const name = req.body.name;
    const username = req.body.username;

    // check if request is complete
    const formComplete = isComplete({ idToken, name, username });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // check if username is valid
    const usernameValid = await util.usernameValid(username);
    if(!usernameValid) return res.json(errorMessage.usernameNotValid);

    // check if profile already exists
    const alreadyExists = await util.profileExists(decodedToken.uid);
    if(alreadyExists) { res.json(errorMessage.profileAlreadyExists); return; }

    // check if username is already taken
    const usernameAlreadyTaken = await util.usernameAlreadyTaken(username);
    if(usernameAlreadyTaken) return res.json(errorMessage.usernameAlreadyTaken);

    // create profile
    await util.createProfile(decodedToken.uid, name, username);

    // send response
    res.json({
        error: false,
        message: "Successfully created profile!"
    })

});
router.post("/profile/exists", async (req, res) => {
    /*
    Total cost:
    - Reads: max. 1
    - Writes: 0
    */

    const idToken = req.body.idToken;

    // check if request is complete
    const formComplete = isComplete({ idToken });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; };  

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // check if profile exists
    const profileExists = await util.profileExists(decodedToken.uid);

    // send response
    res.json({
        error: false,
        message: "Successfully determined whether profile exists or not!",
        profileExists
    })

})
router.post("/profile/get", async (req, res) => {
    /*
    Total cost:
    - Reads: max. 1 + max. 6
    - Writes: 1
    */

    const idToken = req.body.idToken;
    const profileId = req.body.profileId; // if the profileId is not given, we will return the profile of the idToken user

    // check if request is complete
    const formComplete = isComplete({ idToken }); // we only check if the idToken is given, because the profileId is optional
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; };

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; };
    
    // get profile
    const id = profileId ? profileId : (await util.getProfileIdViaUid(decodedToken.uid));
    const profile = await util.getProfile(id);
    if(!profile) { res.json(errorMessage.profileCouldntBeFound); return; }

    // send response
    res.json({
        error: false,
        message: "Successfully got profile!",
        username: profile.username,
        name: profile.name,
        images: profile.images,
        score: profile.score,
        profileImageURL: profile.profileImageURL,
        headerURL: profile.headerURL,
        id: profile.id,
        rank: profile.rank
    })

})
router.post("/profile/update", async (req, res) => {
    /*
    Total cost:
    - Reads: max. 1 + 1
    - Writes: 1
    */

    const idToken = req.body.idToken;
    const username = req.body.username; // optional
    const name = req.body.name; // optional
    const profileImageURL = req.body.profileImageURL; // optional
    const headerURL = req.body.headerURL; // optional

    // check if request is complete
    const formComplete = isComplete({ idToken });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; };

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profile
    const id = await util.getProfileIdViaUid(decodedToken.uid);
    if(id == null) { res.json(errorMessage.profileCouldntBeFound); return; }

    // check if username is valid, when it is provided
    const usernameValid = await util.usernameValid(username);
    if(!usernameValid && username) return res.json(errorMessage.usernameNotValid);

    // check if username is already taken
    const usernameAlreadyTaken = await util.usernameAlreadyTaken(username);
    if(usernameAlreadyTaken && username) return res.json(errorMessage.usernameAlreadyTaken);

    // update profile
    const cleanedUpdate = Object.entries({ username, name, profileImageURL, headerURL }).reduce((a,[k,v]) => (v ? (a[k]=v, a) : a), {});
    await util.updateProfile(id, cleanedUpdate);

    // send response
    res.json({
        error: false,
        message: "Successfully updated profile!"
    })

})
router.post("/profile/remove", async (req, res) => {

    const idToken = req.body.idToken;

    // check if request is complete
    const formComplete = isComplete({ idToken });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; };

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profile
    const id = await util.getProfileIdViaUid(decodedToken.uid);
    if(id == null) { res.json(errorMessage.profileCouldntBeFound); return; }

    // remove profile
    await util.removeProfile(id);

    // send response
    res.json({
        error: false,
        message: "Successfully removed profile!"
    })

})

router.post("/stack/get", async (req, res) => {
    /* 
    Total cost:
    - Reads: max. 1 + 2 + 1
    - Writes: 1
    */

    const idToken = req.body.idToken;

    // check if request is complete
    const formComplete = isComplete({ idToken });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // decode idToken
    const decodedToken = await auth.decodeToken(idToken); 
    if (!decodedToken) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profileID
    const profileID = await util.getProfileIdViaUid(decodedToken.uid);
    if(!profileID) { res.json(errorMessage.profileCouldntBeFound); return; }

    // get random stack
    const nextStack = await util.getRandomStack();
    if(!nextStack) { res.json(errorMessage.internalError); return; }

    // add stack to queue
    await util.updateQueue(profileID, nextStack.id);

    // send response
    res.json({
        error: false,
        message: "Successfully selected random stack!",
        stack: nextStack
    })

})
router.post("/stack/rate", async (req, res) => {
    /*
    Total cost:
    - Reads: max. 1 + 1 + prob. 32 + 1 -> max. 3 + prob.102
    - Writes: 1 + 1
    */

    const idToken = req.body.idToken;
    const stackID = req.body.stack;
    const likedImage = req.body.likedImage;

    // check if request is complete
    const formComplete = isComplete({ idToken, stackID, likedImage });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // decode idToken
    const decodedToken = await auth.decodeToken(idToken); 
    if (!decodedToken) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profileID
    const profileID = await util.getProfileIdViaUid(decodedToken.uid);
    if(!profileID) { res.json(errorMessage.profileCouldntBeFound); return; }

    // check if stack is queued
    const queue = await util.getQueue(profileID);
    if(!queue.includes(stackID)) { res.json(errorMessage.stackNotQueued); return; } 

    // rate stack
    await util.rateStack(stackID, likedImage);
    
    // update queue
    await util.removeFromQueue(profileID, stackID);

    // send response
    res.json({
        error: false,
        message: "Successfully rated stack!"
    })

})

router.post("/image/upload", async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        // return res.status(400).send('No files were uploaded.');
        return res.json(errorMessage.noFilesUploaded);
    } 

    // get file
    const file = req.files.file; 
    const name = [...Array(10)].map(i => (~~(Math.random() * 36)).toString(36)).join("") + ".png"

    // upload file to firebase
    await storage.upload(name, file.data);

    // get download url
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/revit-f67b2.appspot.com/o/${name}?alt=media`

    // send response
    res.json({
        error: false,
        message: "Successfully uploaded image!",
        downloadURL
    })

})
router.post("/image/add", async (req, res) => {
    /* 
    Total cost:
    - Reads: max. 1 + prob. 31
    - Writes: 2
    */

    const idToken = req.body.idToken;
    const downloadURL = req.body.downloadURL;

    // check if request is complete
    const formComplete = isComplete({ idToken, downloadURL });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // decode idToken
    const decodedToken = await auth.decodeToken(idToken); 
    if (!decodedToken) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profileID
    const profileID = await util.getProfileIdViaUid(decodedToken.uid);
    if(!profileID) { res.json(errorMessage.profileCouldntBeFound); return; }

    // create image
    await util.createImage(profileID, downloadURL);

    // send response
    res.json({
        error: false,
        message: "Successfully added image!"
    })

})
router.post("/image/get", async (req, res) => {
    /*
    Total cost:
    - Reads: 1
    - Writes: 0
    */

   const imageId = req.body.imageId;

   // check if request is complete
   const formComplete = isComplete({ imageId });
   if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

   // get image
   const image = await util.getImage(imageId);
   if(!image) { res.json(errorMessage.imageCouldntBeFound); return; }

// await new Promise((resolve) => setTimeout(resolve, 1000 * 3));

   // send response
   res.json({
       error: false,
       message: "Successfully got image!",
       downloadURL: image.downloadURL,
       profile: image.profile,
       value: image.value,
       id: imageId,
       upvotes: image.likes,
       downvotes: image.dislikes,
       score: image.score ? image.score : 0
   })

})
router.post("/image/remove", async (req, res) => {
    /*
    Total cost:
    - Reads: prob. 1 + 1
    - Deletes: 1
    */

    const idToken = req.body.idToken;
    const imageId = req.body.imageId;
    
    // check if request is complete
    const formComplete = isComplete({ idToken, imageId });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get profile
    const id = await util.getProfileIdViaUid(decodedToken.uid);
    if(id == null) { res.json(errorMessage.profileCouldntBeFound); return; }

    // check if profile actually uploaded the image
    const imageData = await util.getImage(imageId);
    if(!imageData) { res.json(errorMessage.imageCouldntBeFound); return; }
    if(imageData.profile != id) { res.json(errorMessage.notEnoughPermissionsToDeleteImage); return; }

    // delete image
    await util.deleteImage(imageId);

    // send response
    res.json({
        error: false,
        message: "Successfully removed image!"
    })

})

router.post("/ranklist/get", async (req, res) => {

    const idToken = req.body.idToken;
    const lastProfileId = req.body.lastProfileId;

    // check if request is complete
    const formComplete = isComplete({ idToken });
    if (!formComplete) { res.json(errorMessage.incompleteForm); return; }

    // verify idToken
    const decodedToken = await auth.verifyIdToken(idToken);
    if(decodedToken == null) { res.json(errorMessage.failedToVerifyIdToken); return; }

    // get ranklist
    const list = await util.getRanklist(lastProfileId);

    // send response
    res.json({
        error: false,
        message: "Successfully got ranklist!",
        ranklist: list.map((profile) => ({
            id: profile.id,
            images: profile.images,
            username: profile.username,
            name: profile.name,
            score: profile.score,
            profileImageURL: profile.profileImageURL,
            headerURL: profile.headerURL,
            rank: profile.rank
        }))
    })

})

/* exports */
module.exports = router;