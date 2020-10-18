const errorCode = {
    "1": "Request data is incomplete!",
    "2": "Stack isn't queued for the profile!",
    "3": "Failed to verify idToken!",
    "4": "Profile already exists!",
    "5": "Profile couldn't be found!",
    "6": "Image couldn't be found!",
    "7": "Internal server error!",
    "8": "You don't have permission to delete this image!",
    "9": "No files were uploaded!",
    "10": "Username is already taken!",
    "11": "Username is not valid!"
};
const errorTemplate = (code) => {
    return {
        "error": {
            code,
            message: errorCode[code]
        }
    }
}
const errorMessage = {
    "incompleteForm": errorTemplate(1),
    "stackNotQueued": errorTemplate(2),
    "failedToVerifyIdToken": errorTemplate(3),
    "profileAlreadyExists": errorTemplate(4),
    "profileCouldntBeFound": errorTemplate(5),
    "imageCouldntBeFound": errorTemplate(6),
    "internalError": errorTemplate(7),
    "notEnoughPermissionsToDeleteImage": errorTemplate(8),
    "noFilesUploaded": errorTemplate(9),
    "usernameAlreadyTaken": errorTemplate(10),
    "usernameNotValid": errorTemplate(11)
}

module.exports = { errorMessage }