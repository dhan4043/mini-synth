/* MODULES */
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");

/* GLOBALS & CONSTANTS */
let patchDB;
const DEFAULT_PATCH = {
  name: "default",
  adsr: [0.4, 0.6, 0.7, 0.5],
  waveform: 0,
  volume: 0.5,
};

/* DATABASE FUNCTIONS */
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const db_username = process.env.MONGO_DB_USERNAME;
const db_password = process.env.MONGO_DB_PASSWORD;
const uri = `mongodb+srv://${db_username}:${db_password}@cluster0.ger4a4y.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;

class PatchDB {
  async connect(uri) {
    const client = new MongoClient(uri, {
      serverApi: ServerApiVersion.v1,
    });
    try {
      const connection = await client.connect();
      this.db = connection.db(process.env.MONGO_DB_NAME);
    } catch (e) {
      console.error(e);
    }
  }
  async close() {
    return await this.db.close();
  }
  async createPatch(patch) {
    await this.db.collection(process.env.MONGO_COLLECTION).insertOne(patch);
  }
  async getPatch(name) {
    let filter = { name: name };
    const result = await this.db
      .collection(process.env.MONGO_COLLECTION)
      .findOne(filter);
    return result;
  }
  async deletePatch(name) {
    let filter = { name: name };
    const result = await this.db
      .collection(process.env.MONGO_COLLECTION)
      .deleteOne(filter);
    return result.deletedCount;
  }
}

/* EXPRESS SERVER */
process.stdin.setEncoding("utf-8");
if (process.argv.length != 3) {
  process.stdout.write("Usage index.js PORT_NUMBER");
  process.exit(1);
}
const portNumber = process.argv[2];
const app = express();

// Directory where templates will reside
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

// Initializes request.body with post information
app.use(bodyParser.urlencoded({ extended: false }));

// Use stylesheet in templates
app.use(express.static("public"));

// Handle commands
console.log(`Server listening on port ${portNumber}`);
const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  const dataInput = process.stdin.read();
  if (dataInput !== null) {
    const command = dataInput.trim();
    if (command === "stop") {
      process.stdout.write("Shutting down the server");
      patchDB.close();
      process.exit(0);
    } else {
      process.stdout.write(`Invalid command: ${command}\n`);
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});

// Homepage
app.get("/", async (request, response) => {
  const vars = {
    patch: DEFAULT_PATCH
  };
  response.render("index", vars);
});

// Load a custom patch by name
app.post("/load", async (request, response) => {
  const name = request.body.load;
  const patch = await patchDB.getPatch(name);
  const vars = {
    patch: patch ?? DEFAULT_PATCH
  };
  response.render("index", vars);
});

// Add custom patch
app.post("/add", async (request, response) => {
  const newPatch = {
    name: request.body.add,
    adsr: request.body.savedAdsr,
    waveform: request.body.savedWaveform,
    volume: request.body.savedVolume
  };
  await patchDB.createPatch(newPatch);

  const vars = {
    patch: DEFAULT_PATCH,
  };
  response.render("index", vars);
});

// Delete custom patch
app.post("/delete", async (request, response) => {
  await patchDB.deletePatch(request.body.delete);
  
  const vars = {
    patch: DEFAULT_PATCH,
  };
  response.render("index", vars);
});

// Start the server
app.listen(portNumber);

/* MAIN */
async function main() {
  patchDB = new PatchDB();
  await patchDB.connect(uri);
}
main();
