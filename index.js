const express = require("express");
const app = express();
const cors = require("cors");
objectId = require("mongodb").ObjectId;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT;
app.use(express.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const database = client.db("test");
    const productCollection = database.collection("products");

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    app.get("/api/products", async (req, res) => {
      const products = await productCollection.find({}).toArray();
      res.json(products);
    });
    app.get("/api/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({ _id: new objectId(id) });
      res.json(product);
    });
     

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
