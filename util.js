/* imports */
const db = require("./firebase/db.js");
const admin = require("firebase-admin");
const logger = require("./log.js");


/* config */
// the lower the factor the more easy it is to get a good score on an image
const factor = 0.25;


/* functions */
const getID = async () => [...Array(20)].map(i => (~~(Math.random() * 36)).toString(36)).join("");
const random = (number) => Math.floor(Math.random() * number);
const usernameValid = async (username) => {
    if(username == null || username == "") {
        return false;
    }
    if(username.includes(" ")) {
        return false;
    }
    return true;
}

const logRead = () => logger.event("read").trigger();
const logWrite = () => logger.event("write").trigger();
const logDelete = () => logger.event("delete").trigger();

// image
const createImage = async (profileId, downloadURL) => {
    /*
    Reads: 1
    Writes: 2
    Total cost:
    - Reads: 1 + prob. 30
    - Writes: 2
    */

    const id = await getID();

    // create references for the image and the profile
    const imageRef = db.collection("images").doc(id);
    const profileRef = db.collection("profiles").doc(profileId);

    // get profile and check if it exists
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return false;

    // create image
    await imageRef.set({
        id,
        profile: profileId,
        downloadURL,
        likes: 1,
        dislikes: 1,
        value: 1,
        score: 0
    });
    logWrite();

    // create stack which includes the image
    const secondImageData = await getImageByValue(1, [ { id } ]);
    if(secondImageData) await createStack([ id, secondImageData.id ]);

    // add imageId to profile
    const updatedImageList = profile.data().images.concat([id]);
    await profileRef.set({ images: updatedImageList }, { merge: true });
    logWrite();

    return true;

}
const likeImage = async (imageId) => {
    /*
    Reads: 1
    Writes: 1
    */

    // create reference for image
    const imageRef = db.collection("images").doc(imageId);

    // get image data
    const image = await imageRef.get();
    logRead();
    if(!image.exists) return null;
    const imageData = image.data();

    // update like and value count
    const updatedLikeCount = imageData.likes + 1;
    const updatedValue = updatedLikeCount / imageData.dislikes;

    // the higher the factor the more easy it is to get a good score on an image
    const score = Math.sqrt(updatedValue / factor);

    // update image
    await imageRef.set({ likes: updatedLikeCount, value: updatedValue, score }, { merge: true });
    logWrite();

}
const dislikeImage = async (imageId) => {

    // create reference for image
    const imageRef = db.collection("images").doc(imageId);

    // get image data
    const image = await imageRef.get();
    logRead();
    if(!image.exists) return null;
    const imageData = image.data();

    // update dislike and value count
    const updatedDislikeCount = imageData.dislikes + 1;
    const updatedValue = imageData.likes / updatedDislikeCount;

    // the higher the factor the more easy it is to get a good score on an image
    const score = Math.sqrt(updatedValue / factor);

    // update image
    await imageRef.set({ dislikes: updatedDislikeCount, value: updatedValue, score }, { merge: true });
    logWrite();

}
const calculateImageScore = async (imageId) => {

    // create reference for image
    const imageRef = db.collection("images").doc(imageId);

    // get image data
    const image = await imageRef.get();
    logRead();
    if(!image.exists) return null;
    const imageData = image.data();

    const updatedValue = imageData.likes / imageData.dislikes;

    const score = Math.sqrt(updatedValue / factor);

    return score;

}
const getImageByValue = async (value, excludeImages = [], difference = 0.1, counter = 0) => {
    /*
    Reads: prob. 30, max. 200 (Depending on how many times the function is rerun)
    Writes: 0
    */

    if(counter == 10) return null;

    // get all images which value is in the range of (value + difference) - (value - difference)
    const queryResult = await db.collection("images").where("value", "<", value + difference).where("value", ">", value - difference).limit(20).get();
    const docs = queryResult.docs.map((doc) => doc.data());
    docs.forEach(() => logRead());

    // filter out every image that's on the excludeImages list
    const result = docs.reduce((prev, doc) => {
        const shouldBeExcluded = excludeImages.reduce((pre, cur) => { if(doc.id == cur.id) return true; return pre; }, false);
        if(shouldBeExcluded) return prev;
        return doc;
    }, null);

    // if no images remain, after filtering them, rerun function but with a higher difference
    if(result == null) {
        const finalResult = await getImageByValue(value, excludeImages, difference + difference, counter + 1);
        return finalResult;
    }

    // else return the result
    return result;

}
const getImage = async (imageId) => {
    /*
    Reads: 1
    */

    // create reference for image
    const imageRef = db.collection("images").doc(imageId);

    // get data of image
    const image = await imageRef.get();
    logRead();
    if(!image.exists) return null;
    const imageData = image.data();

    return imageData;

}
const removeImageFromProfile = async (profileId, imageId) => {

    // create reference
    const profileRef = db.collection("profiles").doc(profileId);

    // remove imageId from images list in profile
    await profileRef.update({ images: admin.firestore.FieldValue.arrayRemove(imageId) });

}
const deleteImage = async (imageId) => {
    /*
    Deletes: 1
    */

    // create reference
    const imageRef = db.collection("images").doc(imageId);

    // get image profile
    const image = await imageRef.get();
    const profileId = image.data().profile;

    // delete image
    await imageRef.delete();
    logDelete();

    // remove all stacks that contain image
    const stacksDataSnapshot = await db.collection("stacks").where("images", "array-contains", imageId).get();
    const stacksData = stacksDataSnapshot.docs.map((doc) => doc.data());
    stacksData.forEach(() => logRead());
    const promises = stacksData.map(async (stackData) => removeStack(stackData.id));
    await Promise.all(promises);

    // remove image from profile
    await removeImageFromProfile(profileId, imageId);

}
const getImageData = async (imageId) => {

    // create reference for image
    const imageRef = db.collection("images").doc(imageId);

    // get data of image
    const image = await imageRef.get();
    logRead();
    if(!image.exists) return null;
    return image.data();

}
const getAllImages = async () => {

    // get every image
    const snapshot = await db.collection("images").get();
    const docs = snapshot.docs.map((doc) => doc.data());
    docs.forEach(() => logRead());

    return docs;

}
const updateImage = async (imageId, updatedProperties) => {

    const imageRef = db.collection("images").doc(imageId);

    await imageRef.set(updatedProperties, { merge: true });
    logWrite();

}
const removeImage = async (imageId) => {

    const imageRef = db.collection("images").doc(imageId);

    // delete every stack that contains the image
    const snapshot = await db.collection("stacks").where("images", "array-contains", imageId).get();
    const stacks = snapshot.docs.map((doc) => doc.data());
    stacks.forEach(() => logRead());
    await Promise.all(
        stacks.map(async (stack) => {
            await removeStack(stack.id)
            logDelete();
        })
    )

    // delete image
    await imageRef.delete();
    logDelete();

}

// profile
const createProfile = async (uid, name, username) => {
    /*
    Reads: 0
    Writes: 1
    */

    const id = await getID();

    // create reference for profile
    const profileRef = db.collection("profiles").doc(id);

    // create profile
    await profileRef.set({
        id,
        uid,
        name,
        username,
        queue: [],
        images: [],
    });
    logWrite();

    return true;

}
const profileExists = async (uid) => {
    /*
    Reads: max. 1 (Depends on if a profile with that same uid exists, it's either going to be 1 or 0)
    Writes: 0
    */

    // get every profile with the same uid
    const snapshot = await db.collection("profiles").where("uid", "==", uid).limit(1).get();
    if(!snapshot.empty) logRead();

    // if snapshot is empty, the profile doesn't exists, otherwise there is at least one profile with that uid
    if(snapshot.empty) return false;
    return true;

}
const getProfileIdViaUid = async (uid) => {
    /*
    Reads: prob. 1 (Depends on if a profile with that same uid exists, it's either going to be 1 or 0)
    Writes: 0
    */

    // get every profile with the same uid
    const snapshot = await db.collection("profiles").where("uid", "==", uid).limit(1).get();
    if(!snapshot.empty) logRead();

    // if snapshot is empty, the profile doesn't exists, otherwise there is at least one profile with that uid
    if(snapshot.empty) return null;
    // return id of the profile
    return snapshot.docs[0].data().id;

}
const calculateProfileScore = async (profileData) => {
    /*
    Reads: prob. 5 (Depends on how many images the profile uploaded)
    Writes: 0
    */

    // fetch every image the profile uploaded
    const images = await Promise.all(profileData.images.map(async (imageId) => { return (await getImage(imageId))}));
    images.forEach(() => logRead());
    // filter out every image that doesn't exist anymore
    const filteredImages = images.filter((value) => value != null);

    if(filteredImages.length == 0) return 0;
    // add each image value together then divide by the total number of images
    const combinedScores = filteredImages.map((data) => data.score ? data.score : 0);
    const score = combinedScores.reduce((prev, cur) => prev + cur) / filteredImages.length;
    return score;

}
const getProfile = async (profileId) => {
    /*
    Reads: 1
    Writes: 1
    Total cost:
    - Reads: 1 + prob. 5 (Depends on how many images the profile uploaded),
    - Writes: 1
    */

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get data of profile
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return null;
    const profileData = profile.data();

    // calculate score of profile
    const profileScore = await calculateProfileScore(profileData);
    await profileRef.set({ score: profileScore }, { merge: true });
    logWrite();

    return Object.assign(profileData, { score: profileScore });

}
const updateProfile = async (profileId, updateObject) => {
    /*
    Reads: 1
    Writes: 1
    */

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get data of profile
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return null;
    const profileData = profile.data();

    // update profile
    const updatedProfile = Object.assign(profileData, updateObject);
    await profileRef.set(updatedProfile, { merge: true });
    logWrite();

    return true;

}
const getAllProfiles = async () => {

    // get every profile
    const snapshot = await db.collection("profiles").get();
    const docs = snapshot.docs.map((doc) => doc.data());
    docs.forEach(() => logRead());

    return docs;   

}
const getProfileData = async (profileId) => {

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get data of profile
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return null;
    return profile.data();

}
const getAllProfilesSortedByTheirScore = async () => {

    // this needs to be refactored
    // because they will probably be millions of profiles the memory can't store it all in one variable
    const snapshot = await db.collection("profiles").orderBy("score", "desc").get();
    const docs = snapshot.docs.map((doc) => doc.data());
    docs.forEach(() => logRead());
    return docs;

}
const usernameAlreadyTaken = async (username) => {

    // get every profile  with the same username
    const snapshot = await db.collection("profiles").where("username", "==", username).get();

    if(snapshot.empty) return false;
    snapshot.docs.forEach(() => logRead());
    return true;

}
const removeProfile = async (profileId) => {

    const profileRef = db.collection("profiles").doc(profileId);

    // get profile
    const profile = await getProfile(profileId);

    // delete all images that are linked to the profile
    await Promise.all(
        profile.images.map(async (imageId) => {
            await removeImage(imageId);
            logDelete();
        })
    )

    // delete profile
    await profileRef.delete();
    logDelete();

}

// stack
const createStack = async (images) => {
    /*
    Reads: 1
    Writes: 2
    */

    const id = await getID();

    // create reference for stack
    const stackRef = db.collection("stacks").doc(id);

    // create stack
    await stackRef.set({ id, images });
    logWrite();

    // add stack to data/stacks/list document
    // this document stores the id of every stack
    // it is needed for randomly selecting a stack
    const stacksRef = db.collection("data").doc("stacks");
    const stacks = await stacksRef.get();
    logRead();
    const updatedList = stacks.data().list.concat([id]);
    await stacksRef.set({ list: updatedList }, { merge: true });
    logWrite();

    return true;

}
const getAllStackIDs = async () => {
    /*
    Reads: 1
    Writes: 0
    */
    
    const stacksRef = db.collection("data").doc("stacks");
    const stacks = await stacksRef.get();
    logRead();
    const stacksData = stacks.data();

    return stacksData.list;

}
const getRandomStack = async () => {
    /*
    Reads: 1
    Writes: 0
    Total cost:
    - Reads: 2
    - Writes: 0
    */

    // get every Stack's ID
    const stackIDs = await getAllStackIDs();
    if(stackIDs.length == 0) return null;

    // select random stack
    const stackID = stackIDs[random(stackIDs.length)];
    const stack = await db.collection("stacks").doc(stackID).get();
    logRead();
    const stackData = stack.data();

    return stackData;

}
const mixStack = async (stackId) => {
    /*
    Reads: prob. 2 (Depends on how many images the stack has)
    Writes: 1
    Total cost:
    - Reads: prob. 2 + prob. 30
    - Writes: 1
    */

    // create reference for stack
    const stackRef = db.collection("stacks").doc(stackId);

    // get data of stack
    const stack = await stackRef.get();
    logRead();
    if(!stack.exists) return null; 
    const stackData = stack.data();

    // get image data for each image on the stack
    const imagesData = await Promise.all(stackData.images.map(async (imageID) => (await db.collection("images").doc(imageID).get()).data()));
    imagesData.forEach(() => logRead());

    // select random image
    const image = imagesData[random(imagesData.length)];
    // get image that has the nearest value to the selected image
    const nearestImage = await getImageByValue(image.value, [ image ]);
    if(!nearestImage) return;
    // update stack
    await stackRef.set({ images: [ image.id, nearestImage.id ] }, { merge: true });
    logWrite();

    return true;
}
const rateStack = async (stackId, likedImageId) => {
    /* 
    Reads: 1
    Total cost:
    - Reads: 1 + 1 + prob. 1 + prob. 30 (Depends on how many disliked images there are)
    - Writes: 1 + prob. 1 (Depends on how many disliked images there are)
    */

    // create reference for stack
    const stackRef = db.collection("stacks").doc(stackId);

    // get stack data
    const stack = await stackRef.get();
    logRead();
    if(!stack.exists) return null;
    const stackData = stack.data();

    // like image
    if(!stackData.images.includes(likedImageId)) return null;
    await likeImage(likedImageId);

    // dislike remaining images
    const remainingImages = stackData.images.filter((id) => id != likedImageId);
    await Promise.all( remainingImages.map(async (imageId) => await dislikeImage(imageId)) );

    // mix stack
    await mixStack(stackId);

    return true;

}
const removeStack = async (stackId) => {

    // create reference for stack
    const stackRef = db.collection("stacks").doc(stackId);

    // remove stack
    await stackRef.delete();
    logDelete();

    // remove stack from data/stacks/list
    await db.collection("data").doc("stacks").update({ list: admin.firestore.FieldValue.arrayRemove(stackId) });
    logWrite();

}
const getAllStacks = async () => {

    // get every stack
    const snapshot = await db.collection("stacks").get();
    const docs = snapshot.docs.map((doc) => doc.data());
    docs.forEach(() => logRead());

    return docs;

}

// queue
const updateQueue = async (profileId, stackId) => {
    /*
    Reads: 1
    Writes: 1
    */

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get data of profile
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) throw new Error(`Profile [${profileId} couldn't be found!]`);
    const profileData = profile.data();

    // update profile
    /* if(profileData.queue.length > 5) {
        for(var i = 0; i < profileData.queue.length - 5; i ++) {
            console.log("Remove!");
            await profileRef.update({ "queue": admin.firestore.FieldValue.arrayRemove(profileData.queue[i]) })
        }
    } */
    /* const updatedQueue = profileData.queue.concat([stackId]);
    const filteredQueue = updatedQueue.length > 5 ? updatedQueue.filter((el, index) => index != 0) : updatedQueue;
    await profileRef.set({ queue: filteredQueue }, { merge: true });
    logWrite(); */
    await profileRef.update({ "queue": admin.firestore.FieldValue.arrayUnion(stackId) })

}
const getQueue = async (profileId) => {
    /* 
    Reads: 1
    */

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get profile data
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return null;
    const profileData = profile.data();

    // return queue
    return profileData.queue;

}
const removeFromQueue = async (profileId, stackId) => {
    /*
    Reads: 1
    Writes: 1
    */

    // create reference for profile
    const profileRef = db.collection("profiles").doc(profileId);

    // get data of profile
    const profile = await profileRef.get();
    logRead();
    if(!profile.exists) return null;
    const profileData = profile.data();
    
    // update queue
    /* const updatedQueue = profileData.queue.filter((element) => element != stackId);
    await profileRef.set({ queue: updatedQueue }, { merge: true });
    logWrite(); */
    await profileRef.update({ "queue": admin.firestore.FieldValue.arrayRemove(stackId) })

    return true;

}

// ranklist
const getRanklist = async (lastProfileId) => {

    const profile = lastProfileId ? await db.collection("profiles").doc(lastProfileId).get() : null;
    const snapshot = await profile ? 
        await db.collection("profiles")
        .orderBy("rank")
        .startAfter(profile)
        .limit(3)
        .get() : 
        await db.collection("profiles")
        .orderBy("rank")
        .limit(3)
        .get();

    const docs = snapshot.docs.map((doc) => doc.data());
    if(profile != null) {
        console.log("Profile:", profile.data().name);
    } else {
        console.log("Profile: null");
    }
    console.log("Result:", docs.map(e => e.name));
    docs.forEach(() => logRead());

    return docs;

}


/* exports */
module.exports = {
    // image
    createImage,
    getImage,
    deleteImage,
    getImageData,
    removeImageFromProfile,
    getAllImages,
    calculateImageScore,
    updateImage,
    removeImage,
    // profile
    createProfile,
    profileExists,
    getProfileIdViaUid,
    getProfile,
    updateProfile,
    getAllProfiles,
    getProfileData,
    calculateProfileScore,
    getAllProfilesSortedByTheirScore,
    usernameAlreadyTaken,
    usernameValid,
    removeProfile,
    // stack
    createStack,
    getRandomStack,
    rateStack,
    getAllStacks,
    removeStack,
    // queue
    updateQueue,
    getQueue,
    removeFromQueue,
    // ranklist
    getRanklist,

    logger
}