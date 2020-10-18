/* imports */
const db = require("./firebase/db.js");


/* functions */








/* pure */
const nearestTo = (number, x, y) => {
    if (x != y) {
      x1 = Math.abs(x - number);
      y1 = Math.abs(y - number);
  
      if (x1 < y1) {
        return x;
      }
      if (y1 < x1) {
        return y;
      }
      return 0;
  
    } 
    return x;
}
const random = (number) => Math.floor(Math.random() * number);
const getID = async () => [...Array(10)].map(i => (~~(Math.random() * 36)).toString(36)).join("");


/* functions */
const getImage = async (imageId) => {

    const imageRef = db.collection("images").doc(imageId);
    const image = await imageRef.get();
    if(!image.exists) return null;
    const imageData = image.data();

    return imageData;

}
const getAllStackIDs = async () => {

    const stacksRef = db.collection("data").doc("stacks");
    const stacks = await stacksRef.get();
    const stacksData = stacks.data();

    return stacksData.list;

}
const createStack = async (images) => {

    const id = await getID();
    const stackRef = db.collection("stacks").doc(id);

    // create Stack
    await stackRef.set({ images, id });

    // add stack to data/stacks/list
    const stacksRef = db.collection("data").doc("stacks");
    const stacks = await stacksRef.get();
    const stacksData = stacks.data();
    const updatedList = stacksData.list.concat([id]);
    await stacksRef.set({ list: updatedList }, { merge: true });

    // return id of newly created stack
    return id;

}
const calculateProfileScore = async (profileData) => {

    const images = await Promise.all(profileData.images.map(async (imageId) => { return (await getImage(imageId))}));
    if(images.length == 0) return 0;
    const combinedScores = images.map((data) => data.value);
    const score = combinedScores.reduce((prev, cur) => prev + cur) / images.length;
    return score;

}
const updateProfile = async (profileId, update) => {

    const profileRef = db.collection("profiles").doc(profileId);
    const profile = await profileRef.get();
    if(!profile.exists) return null;
    const profileData = profile.data();

    const cleanedUpdate = Object.entries(update).reduce((a,[k,v]) => (v ? (a[k]=v, a) : a), {})
    const updatedProfile = Object.assign(profileData, cleanedUpdate);
    await profileRef.set(updatedProfile, { merge: true });

}
const createProfile = async (uid, name, username, profileImageURL) => {

    const id = await getID();
    const profileRef = db.collection("profiles").doc(id);
  
    // create profile
    await profileRef.set({ images: [], id, uid, name, username, queue: [], profileImageURL })

    // return id for newly created profile
    return id;

}
const profileExists = async (uid) => {

    // get every profile with the same uid
    const snapshot = await db.collection("profiles").where("uid", "==", uid).get();
    if(snapshot.empty) return false;
    return true;

}
const createImage = async (profileID, downloadURL) => {

    const id = await getID();
    const imageRef = db.collection("images").doc(id);
    const profileRef = db.collection("profiles").doc(profileID);
    const profile = await profileRef.get();
    if(!profile.exists) return;
    const profileData = profile.data();
  
    // add image to profile
    const newImages = profileData.images.concat([id]);
    await profileRef.set({ images: newImages }, { merge: true })
  
    // create image
    await imageRef.set({ 
      profile: profileID, 
      downloadURL,
      id,
      likes: 1, 
      dislikes: 1,
      value: 1
    })

    // create stack which includes the image
    const secondImageData = await getImageByValue(1, [ { id } ]);
    if(secondImageData) await createStack([ id, secondImageData.id ]);

    // return id for newly created image
    return id;

}
const getImageByValue = async (value, excludeImages = []) => {

    // get every image
    const snapshot = await db.collection("images").get();
    const docs = snapshot.docs.map((doc) => doc.data());

    // get image with the nearest value to the provided `value` in the arguments
    // that is at the same time not present in the `excludeImages` list
    const nearestDoc = docs.reduce((prev, doc) => {

        // check if doc is present in the `excludeImages` list
        const shouldBeExcluded = excludeImages.reduce((pre, cur) => { if(doc.id == cur.id) return true; return pre; }, false);
        // console.log("Exclude?", shouldBeExcluded);
        if(shouldBeExcluded) return prev; 

        if(prev == null) { return doc };
        
        // compare previous doc to current doc
        const nearestValue = nearestTo(value, prev.value, doc.value);
        // and return the doc with the nearest value
        if(nearestValue == prev.value) return prev;
        if(nearestValue == doc.value) return doc;

        return doc;

    }, null)
    return nearestDoc;

}
const mixStack = async (stackID) => {

    const stackRef = db.collection("stacks").doc(stackID);
    const stack = await stackRef.get();
    if(!stack.exists) throw new Error(`Stack [${stackID}] couldn't be found!`); 
    const stackData = stack.data();

    const imagesData = await Promise.all(stackData.images.map(async (imageID) => (await db.collection("images").doc(imageID).get()).data()));

    const image = imagesData[random(imagesData.length)];
    const nearestImage = await getImageByValue(image.value, [ image ]);
    if(!nearestImage) return;
    await stackRef.set({ images: [ image.id, nearestImage.id ] }, { merge: true });

}
const likeImage = async (imageID) => {

    const imageRef = db.collection("images").doc(imageID);
    const image = await imageRef.get();
    if(!image.exists) throw new Error(`Image [${imageID}] couldn't be found!`);
    const imageData = image.data();

    const updatedLikeCount = imageData.likes + 1;
    const updatedValue = updatedLikeCount / imageData.dislikes;

    // update image
    await imageRef.set({ likes: updatedLikeCount, value: updatedValue }, { merge: true });

}
const dislikeImage = async (imageID) => {

    const imageRef = db.collection("images").doc(imageID);
    const image = await imageRef.get();
    if(!image.exists) throw new Error(`Image [${imageID}] couldn't be found!`);
    const imageData = image.data();

    const updatedDislikeCount = imageData.dislikes + 1;
    const updatedValue = imageData.likes / updatedDislikeCount;

    // update image
    await imageRef.set({ dislikes: updatedDislikeCount, value: updatedValue }, { merge: true });

}
const updateQueue = async (profileID, stackID) => {

    const profileRef = db.collection("profiles").doc(profileID);
    const profile = await profileRef.get();
    if(!profile.exists) throw new Error(`Profile [${profileID} couldn't be found!]`);
    const profileData = profile.data();

    // update profile
    const updatedQueue = profileData.queue.concat([stackID]);
    const filteredQueue = updatedQueue.length > 5 ? updatedQueue.filter((el, index) => index != 0) : updatedQueue;
    await profileRef.set({ queue: filteredQueue }, { merge: true });

}
const removeFromQueue = async (profileID, stackID) => {

    const profileRef = db.collection("profiles").doc(profileID);
    const profile = await profileRef.get();
    if(!profile.exists) throw new Error(`Profile [${profileID} couldn't be found!]`);
    const profileData = profile.data();
    
    const updatedQueue = profileData.queue.filter((element) => element != stackID);
    await profileRef.set({ queue: updatedQueue }, { merge: true });

}
const getQueue = async (profileID) => {

    const profileRef = db.collection("profiles").doc(profileID);
    const profile = await profileRef.get();
    if(!profile.exists) throw new Error(`Profile [${profileID}] couldn't be found!`);
    const profileData = profile.data();

    return profileData.queue;

}
const rateStack = async (stackID, likedImageID) => {

    const stackRef = db.collection("stacks").doc(stackID);
    const stack = await stackRef.get();
    if(!stack.exists) throw new Error(`Stack [${stackID}] couldn't be found!`);
    const stackData = stack.data();

    // like image
    if(!stackData.images.includes(likedImageID)) throw new Error(`Stack [${stackID}] doesn't include likedImage [${likedImageID}]!`);
    await likeImage(likedImageID);

    // dislike remaining images
    const remainingImages = stackData.images.filter((id) => id != likedImageID);
    await Promise.all( remainingImages.map(async (imageID) => await dislikeImage(imageID)) );

    // mix stack
    await mixStack(stackID);

}
const getRandomStack = async () => {

    // get every Stack's ID
    const stackIDs = await getAllStackIDs();

    // select random stack
    const stackID = stackIDs[random(stackIDs.length)];
    const stack = await db.collection("stacks").doc(stackID).get();
    const stackData = stack.data();

    return stackData;

}
const getProfileID = async (uid) => {

    // get every profile with the same uid
    const snapshot = await db.collection("profiles").where("uid", "==", uid).get();

    if(snapshot.empty) return null;
    return snapshot.docs[0].data().id;

}
const getProfile = async (profileId) => {

    const profileRef = db.collection("profiles").doc(profileId);
    const profile = await profileRef.get();
    if(!profile.exists) return null;
    const profileData = profile.data();

    const profileScore = await calculateProfileScore(profileData);
    await profileRef.set({ score: profileScore }, { merge: true });

    return Object.assign(profileData, { score: profileScore });

}

(async () => {

    const profileID = "p0phgmoakz";
    const image1ID = "4q1fiqn4qv";
    const image2ID = "iy653166ox";
    const stackID = "vqxpw0l47u";

    // await createStack([ image1ID, image2ID ]);
    // await mixStack(stackID);

    const result = await rateStack("vqxpw0l47u", "z9zju1oz4a");
    console.log(result);

});


module.exports = {
    createProfile,
    createImage,
    createStack,
    getImageByValue,
    mixStack,
    likeImage,
    dislikeImage,
    rateStack,
    updateQueue,
    getQueue,
    getRandomStack,
    profileExists,
    getProfileID,
    getImage,
    getProfile,
    removeFromQueue,
    updateProfile
}