/* initialize firebase */
require("./firebase/firebase.js").initializeApp();

/* imports */
const express = require("express");
const bodyParser = require("body-parser");
const routes = require("./routes.js");
const cors = require("cors");
const fileUpload = require('express-fileupload');

// !!!!! Don't forget this when debugging something strange !!!!!
// clean leftover things and update the ranks in the database every 24h
const cleaner = require("./cleaner.js");
setInterval(async () => {
    await cleaner.cleanImages();
    await cleaner.cleanProfiles();
    await cleaner.cleanStacks();
    await cleaner.updateRanks();
    console.log("----------------");
    console.log("Finished cleaning:", cleaner.logger.export());
    console.log("----------------");
}, 1000 * 60 * 60 * 24)

const app = express();
const port = 800;

// enable JSON parsing
app.use(bodyParser.json());

// enable fileUpload
app.use(fileUpload());

// enable Cors
app.use(cors());

// add routes
app.use("/", routes);

// start server
app.listen(port, () => console.log(`Server started on port ` + port + `!`));