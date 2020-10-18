/* imports */
const util = require("./util.js");


/* functions */
const checkIfProfilesImageIsValid = async (profileId, imageId) => {
    /*
    Valid means two things:
    - First:
    It needs to exists
    - Second:
    The image needs to link to the profile
    */

    const imageData = await util.getImageData(imageId);

    if(imageData == null) return false;
    if(imageData.profile != profileId) return false;

    return true;

}
const cleanProfilesImages = async (profileId) => {
    /*
    "cleaning" means removing invalid images from the `images` list
    */
    
    const profileData = await util.getProfileData(profileId);

    /* ! This definitely needs to be refactored !*/
    await profileData.images.reduce(async (prev, imageId) => {
            
        const imageList = await prev;

        const isValid = await checkIfProfilesImageIsValid(profileId, imageId);
        if(!isValid) {
            const newImageList = await util.removeImageFromProfile(profileData.id, imageId); 
            return newImageList;
        } else {
            return imageList;
        }

    }, new Promise((resolve) => resolve(profileData.images)));

}
const cleanProfiles = async () => {
    /*
    "cleaning" means 
    - removing invalid images from the `images` list of every profile
    - updating the score
    */

    const profiles = await util.getAllProfiles();
    const promises = profiles.map(async (profileData) => cleanProfilesImages(profileData.id));

    await Promise.all(promises);

    const updatedProfiles = await util.getAllProfiles();
    await Promise.all( updatedProfiles.map(async (profileData) => {
       const score = await util.calculateProfileScore(profileData);
       if(profileData.score != score) await util.updateProfile(profileData.id, { score }) 
    }) )

}
const cleanStacks = async () => {
    /*
    "cleaning" means removing any stack which has an invalid image
    */

    const stacks = await util.getAllStacks();
    const promises = stacks.map(async (stackData) => {

        for(var i = 0; i < stackData.images.length; i ++ ) {

            const isValid = (await util.getImageData(stackData.images[i])) == null ? false : true;
            if(!isValid) {
                await util.removeStack(stackData.id);
                return;
            }
    
        }

    })

    await Promise.all(promises);

}
const cleanImages = async () => {
    /*
    "cleaning" means
    - calculating the image score
    - removing any image which has an invalid profile
    */

    const images = await util.getAllImages();
    await Promise.all( images.map(async (imageData) => {
        const score = await util.calculateImageScore(imageData.id);
        if(score != imageData.score) await util.updateImage(imageData.id, { score });
    }) )

    await Promise.all( images.map(async (imageData) => {
        const profile = await util.getProfileData(imageData.profile);
        if(profile == null) await util.removeImage(imageData.id);
    }) )

}
const updateRanks = async () => {

    const sortedProfiles = await util.getAllProfilesSortedByTheirScore();
    const promises = sortedProfiles.map(async (profile, index) => {
        // the (index + 1) is bascially the rank

        await util.updateProfile(profile.id, { rank: index + 1 });
    })

    await Promise.all(promises);

}


module.exports = {
    cleanProfiles,
    cleanStacks,
    cleanImages,
    updateRanks,
    logger: util.logger
}