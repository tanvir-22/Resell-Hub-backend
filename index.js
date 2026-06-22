const express = require("express");
const app = express();
const cors = require("cors");
objectId = require("mongodb").ObjectId;
const { MongoClient, ServerApiVersion } = require("mongodb");
const { jwtVerify } = require("jose-cjs");
require("dotenv").config();
const port = process.env.PORT;
app.use(express.json());
app.use(cors());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// const verifyToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
//   const token = authHeader.split(" ")[1];
//   try {
//     const secret = new TextEncoder().encode(process.env.JWT_SECRET);
//     const { payload } = await jwtVerify(token, secret);
//     req.session = { user: payload };
//     next();
//   } catch {
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

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
      console.log(process.env.NEXT_URL);
      res.json(products);
    });
    app.get("/api/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({
        _id: new objectId(id),
      });
      res.json(product);
    });

    app.patch("/api/updateproduct/:id", async (req, res) => {
      const id = req.params.id;
      const {
        title,
        description,
        category,
        condition,
        price,
        stock,
        phone,
        images,
      } = req.body;
      console.log("HIT updateproduct, id:", req.params.id, "body:", req.body);
      const updateFields = {};
      if (title !== undefined) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (category !== undefined) updateFields.category = category;
      if (condition !== undefined) updateFields.condition = condition;
      if (price !== undefined) updateFields.price = Number(price);
      if (stock !== undefined) updateFields.stock = Number(stock);
      if (phone !== undefined) updateFields.phone = phone;
      if (images !== undefined) updateFields.images = images;
      updateFields.updatedAt = new Date();

      const result = await productCollection.findOneAndUpdate(
        { _id: new objectId(id) },
        { $set: updateFields },
        { returnDocument: "after" },
      );

      if (!result) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(result);
    });

    app.delete("/api/deleteproduct/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new objectId(id),
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    });

    app.post("/api/createproduct", async (req, res) => {
      const {
        title,
        description,
        category,
        condition,
        price,
        stock,
        phone,
        images,
      } = req.body;
      const { user } = req.body;

      const product = {
        title,
        description,
        category,
        condition,
        price: Number(price),
        stock: Number(stock),
        phone,
        images,
        sellerInfo: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: phone || user.phone,
        },
        status: "pending",
        reported: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await productCollection.insertOne(product);
      res.status(201).json({ insertedId: result.insertedId, ...product });
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
